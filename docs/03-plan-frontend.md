# 03 — Plan de Acción · Frontend (Angular)

> Plan por etapas para el SPA Angular que consume el API Gateway. Cubre el Ej. 2 y contiene la base para la respuesta del Ej. 4 (performance). Incluye el flujo de diseño con **Google Stitch** vía MCP.

---

## 0. Pre-requisitos

- Node.js ≥ 22.11 LTS + pnpm ≥ 11.0
- Angular CLI ≥ 18 (`pnpm dlx @angular/cli@latest`)
- Backend del Ej. 1 corriendo (al menos `auth-service` + `products-service` + `api-gateway`).
- **Stitch MCP configurado** en `.claude/settings.local.json` (ver §1.1).

## 1.1 Workflow de diseño con Google Stitch (MCP)

Google Stitch (`stitch.withgoogle.com`) genera mockups UI/UX con IA y los exporta a múltiples frameworks. Se conecta a Claude Code vía MCP oficial.

### Configuración (ya aplicada)

Claude Code lee los MCP servers locales de `.mcp.json` en el root del proyecto — **no** de `settings.local.json`. El campo `enabledMcpjsonServers` de `settings.local.json` sólo decide cuáles servers del `.mcp.json` están habilitados.

Archivo 1: [`.mcp.json`](../.mcp.json) — root del proyecto, gitignored (contiene la API key).

```json
{
  "mcpServers": {
    "stitch": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@_davideast/stitch-mcp", "proxy"],
      "env": {
        "STITCH_API_KEY": "<key del settings de Stitch>"
      }
    }
  }
}
```

Archivo 2: [`.claude/settings.local.json`](../.claude/settings.local.json) — gitignored, habilita el server.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "enableAllProjectMcpServers": false,
  "enabledMcpjsonServers": ["stitch"]
}
```

> Después de tocar `.mcp.json`, **reiniciar Claude Code con "Developer: Reload Window" en VS Code** para que descubra el MCP server (el watcher de config no recarga MCP servers en caliente). Cerrar/abrir el panel de Claude no alcanza.

### Tools que expone el MCP

| Tool | Para qué sirve |
|------|----------------|
| `list_projects` | Lista tus proyectos en Stitch |
| `get_screen_code` | Devuelve el HTML/Tailwind/Angular del screen seleccionado |
| `get_screen_image` | Devuelve screenshot PNG base64 (clave: permite que Claude **vea** el diseño antes de codear) |
| `build_site` | Mapea múltiples screens a rutas y devuelve estructura del sitio |

### Flujo recomendado

1. **Diseñar en Stitch** los screens principales (login, lista de productos, formulario crear/editar). Usar modo Experimental para alta fidelidad.
2. **Extraer design tokens** — al inicio del proyecto:
   - Pedirle al asistente: *"Usá el Stitch MCP para listar proyectos y traerme la paleta de colores, tipografía y spacing del proyecto '<nombre>'. Volcá todo a `apps/frontend/DESIGN.md`."*
   - Eso queda como **single source of truth** del sistema visual.
3. **Mapear tokens a Tailwind + Material**:
   - Paleta → `apps/frontend/tailwind.config.ts` (`theme.extend.colors`).
   - Misma paleta → custom theme Angular Material con `mat.define-theme()`. Así Material y Tailwind comparten variables CSS.
   - Tipografía → `mat.define-typography-config()` + `font-family` de Tailwind.
4. **Generar componentes pantalla por pantalla**:
   - Pedir: *"Usá el Stitch MCP — `get_screen_image` de la pantalla 'product-list' y `get_screen_code`. Adaptá el HTML a un standalone Angular 18 component, usando `MatTable` + `MatPaginator` para la tabla, Tailwind para layout, signals para state. Aplicá `OnPush`. Seguí el patrón de `docs/03-plan-frontend.md` §Etapa 4."*
   - Claude convierte `<button>` plano → `<button mat-raised-button>`, etc.
5. **Iterar**: cambios visuales en Stitch → re-fetch vía MCP → diff contra componente actual.

### Caveats honestos

- Stitch genera **templates Angular crudos**, no componentes Material idiomáticos. El paso 4 requiere que Claude adapte explícitamente; validá el output con el skill [`angular-clean-code`](../.claude/skills/angular-clean-code.md).
- El wrapper `@_davideast/stitch-mcp` está marcado **experimental**. Si rompe: fallback a OAuth con `gcloud auth application-default login` y `STITCH_USE_SYSTEM_GCLOUD=true` (ver docs oficiales en `stitch.withgoogle.com/docs/mcp/setup/`).
- **Nunca commitear** `.claude/settings.local.json` — el `.gitignore` ya lo excluye.

---

## 1. Stack frontend

| Capa | Decisión | Justificación |
|------|----------|---------------|
| Framework | Angular 18+ | Standalone components, signals, `provideRouter`. Menos boilerplate, performance nativa. |
| Lenguaje | TypeScript `strict` | Tipado fuerte de extremo a extremo. |
| State management | **NgRx Signal Store** | Moderno, basado en signals, menos boilerplate que NgRx clásico. |
| UI library | **Angular Material** | Tabla paginada (`MatTable` + `MatPaginator`) + formularios + a11y out-of-the-box. |
| Styling | Tailwind CSS + theming de Material | Tailwind para layout/utilities; Material define tokens. |
| HTTP | `HttpClient` + interceptors | Estándar Angular. |
| Forms | Reactive Forms tipados | Validaciones espejo del backend. |
| Build | esbuild (Angular default) | Build rápido. |
| Tests | Jest + Spectator + Cypress (e2e opcional) | Jest > Karma para velocidad. |

## 2. Estructura del proyecto

```
apps/frontend/
├── src/
│   ├── app/
│   │   ├── core/                       # Singletons (interceptors, guards, services globales)
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts
│   │   │   │   ├── error.interceptor.ts
│   │   │   │   └── correlation-id.interceptor.ts
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts
│   │   │   ├── services/
│   │   │   │   └── token-storage.service.ts
│   │   │   └── core.providers.ts
│   │   ├── shared/                     # Componentes/pipes/directivas reutilizables
│   │   │   ├── ui/
│   │   │   │   ├── confirm-dialog/
│   │   │   │   ├── empty-state/
│   │   │   │   └── loading-skeleton/
│   │   │   └── pipes/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── login.page.ts
│   │   │   │   │   └── register.page.ts
│   │   │   │   ├── data/
│   │   │   │   │   └── auth.api.ts
│   │   │   │   ├── store/
│   │   │   │   │   └── auth.store.ts    # SignalStore
│   │   │   │   └── auth.routes.ts
│   │   │   └── products/
│   │   │       ├── pages/
│   │   │       │   ├── product-list.page.ts
│   │   │       │   └── product-form.page.ts
│   │   │       ├── components/
│   │   │       │   ├── product-table.component.ts
│   │   │       │   └── product-form.component.ts
│   │   │       ├── data/
│   │   │       │   └── products.api.ts
│   │   │       ├── store/
│   │   │       │   └── products.store.ts
│   │   │       └── products.routes.ts
│   │   ├── layout/
│   │   │   ├── main-layout.component.ts
│   │   │   └── topbar.component.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   └── app.component.ts
│   ├── environments/
│   │   ├── environment.ts               # gitignored, .example versionado
│   │   └── environment.example.ts
│   ├── styles/
│   │   ├── theme.scss
│   │   └── tailwind.css
│   ├── index.html
│   └── main.ts
├── angular.json
├── tailwind.config.js
└── package.json
```

**Decisiones clave:**
- **Standalone components** en toda la app (sin NgModules salvo los del core de Angular Material).
- Cada feature tiene su carpeta con `pages/`, `components/`, `data/` (API client), `store/` (state).
- `core/` solo expone proveedores; nunca componentes.

---

## Etapa 1 — Bootstrap del proyecto

**Objetivo:** app Angular vacía corriendo en `:4200`, conectada al gateway.

**Pasos:**

1. `ng new frontend --standalone --routing --style=scss --strict --ssr=false`.
2. Instalar dependencias:
   ```bash
   pnpm add @angular/material @angular/cdk @ngrx/signals
   pnpm add -D tailwindcss postcss autoprefixer
   ```
3. `ng add @angular/material` → elegir tema (recomendado: Azure/Blue).
4. Configurar Tailwind:
   ```bash
   npx tailwindcss init -p
   ```
5. `environment.example.ts`:
   ```ts
   export const environment = {
     production: false,
     apiBaseUrl: 'http://localhost:4050', // gateway
   };
   ```
6. `app.config.ts`:
   ```ts
   export const appConfig: ApplicationConfig = {
     providers: [
       provideRouter(appRoutes, withComponentInputBinding()),
       provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, correlationIdInterceptor])),
       provideAnimations(),
       importProvidersFrom(MatSnackBarModule),
     ],
   };
   ```

**Verificación:** `ng serve` levanta en `:4200` sin errores.

**Entregable:** [ ] commit `chore(frontend): bootstrap Angular 18 + Material + Tailwind`

---

## Etapa 2 — Core: interceptors + token storage + guards

**Objetivo:** infraestructura de auth lista para que cualquier request lleve JWT automáticamente.

**Pasos:**

1. **`TokenStorageService`** — usa `sessionStorage` por defecto (más seguro que `localStorage` ante XSS, aunque ambos son vulnerables; lo ideal sería httpOnly cookie, fuera de alcance):
   ```ts
   @Injectable({ providedIn: 'root' })
   export class TokenStorageService {
     readonly accessToken = signal<string | null>(sessionStorage.getItem('access') ?? null);
     setAccess(token: string) { sessionStorage.setItem('access', token); this.accessToken.set(token); }
     clear() { sessionStorage.clear(); this.accessToken.set(null); }
   }
   ```
2. **`authInterceptor`** — inyecta `Authorization: Bearer <token>` salvo en endpoints públicos.
3. **`errorInterceptor`** — captura 401 → intenta refresh una vez; si falla, redirige a `/login`. Captura 4xx/5xx y muestra `MatSnackBar` con mensaje amigable.
4. **`correlationIdInterceptor`** — genera UUID y lo manda en `x-correlation-id` (debe coincidir con el header que valida el gateway).
5. **`authGuard`** — `CanActivateFn` que verifica `tokenStorage.accessToken()`; si no hay, redirige a login con `returnUrl`.

**Entregable:** [ ] commit `feat(core): interceptors + auth guard + token storage`

---

## Etapa 3 — Feature: Autenticación

**Objetivo:** páginas de login y register funcionales contra el gateway.

**Pasos:**

1. **`AuthApi`** (servicio inyectable):
   ```ts
   login(dto: LoginDto): Observable<AuthTokens>
   register(dto: RegisterDto): Observable<{ id: string; email: string }>
   refresh(refreshToken: string): Observable<AuthTokens>
   me(): Observable<UserProfile>
   ```
2. **`AuthStore`** (NgRx Signal Store):
   ```ts
   export const AuthStore = signalStore(
     { providedIn: 'root' },
     withState({ user: null, loading: false, error: null }),
     withMethods((store, api = inject(AuthApi), tokens = inject(TokenStorageService)) => ({
       async login(dto: LoginDto) { /* ... */ },
       async logout() { /* ... */ },
     })),
   );
   ```
3. **`LoginPage`** — Reactive Form tipado:
   - Campos: email, password.
   - Validaciones: `Validators.email`, `Validators.minLength(8)`.
   - Botón disabled si form inválido o loading.
   - Mensajes amigables ante error.
4. **`RegisterPage`** — similar, con confirmación de password.

**Verificación:** login real → token persistido → redirección a `/products`.

**Entregable:** [ ] commit `feat(auth): páginas login/register con SignalStore`

---

## Etapa 4 — Feature: Productos

**Objetivo:** CRUD completo + tabla paginada + UX cuidada.

**Pasos:**

1. **`ProductsApi`**:
   ```ts
   list(params: ListParams): Observable<Paginated<Product>>
   getById(id: string): Observable<Product>
   create(dto: CreateProductDto): Observable<Product>
   update(id: string, dto: UpdateProductDto): Observable<Product>
   delete(id: string): Observable<void>
   ```
2. **`ProductsStore`** (SignalStore con `withState`, `withMethods`, `withComputed`):
   - State: `items, total, page, limit, loading, error, selectedId`.
   - Methods: `loadPage`, `create`, `update`, `delete`, `select`.
   - Computed: `totalPages`, `hasItems`.
3. **`ProductListPage`**:
   - `MatTable` con columnas: sku, name, category, price, stock, isActive, actions.
   - `MatPaginator` enlazado al store (`page`, `limit`).
   - Buscador con `debounceTime(300)` en signal/observable.
   - Filtro por categoría (`MatSelect`).
   - Botón "Nuevo producto" → abre `ProductFormDialog`.
   - Acciones por fila: editar / eliminar (con `ConfirmDialog`).
4. **`ProductFormComponent`**:
   - Reactive Form tipado.
   - Validaciones: `sku required`, `price > 0`, `stock >= 0`, `name min 3`.
   - Modo create/edit detectado por presencia de `id`.
5. **UX**:
   - Loading skeletons (no spinners genéricos).
   - Empty state con CTA "Crear primer producto".
   - Toasts en éxito/error vía `MatSnackBar`.
   - Confirmación antes de eliminar.

**Verificación:** flujo completo: crear → ver en tabla → editar → eliminar.

**Entregable:** [ ] commit `feat(products): CRUD con tabla paginada y SignalStore`

---

## Etapa 5 — Responsive & accesibilidad

**Objetivo:** la app funciona bien en mobile (≤ 640px) y cumple a11y básico.

**Pasos:**

1. Layout responsive:
   - Topbar colapsa en menú hamburguesa < 768px.
   - Tabla → cambia a vista de cards en mobile (con `@media` o `BreakpointObserver`).
   - Formularios full-width en mobile.
2. **A11y**:
   - Todos los botones tienen `aria-label` cuando no hay texto visible.
   - Navegación por teclado verificada.
   - Contraste de colores ≥ AA (Material lo cumple por defecto).
   - `mat-form-field` con `<mat-label>` (no placeholder solo).
3. **Performance**:
   - `ChangeDetectionStrategy.OnPush` en todos los componentes.
   - `trackBy` en `*ngFor` o usar `@for` (Angular 17+) con `track`.
   - Lazy load por feature: `loadChildren: () => import('./features/products/products.routes')`.

**Entregable:** [ ] commit `feat(ui): responsive + a11y + lazy routes`

---

## Etapa 6 — Performance (respuesta Ej. 4 demostrada en código)

Técnicas implementadas que se citan en el documento teórico:

| Técnica | Implementación |
|---------|----------------|
| **Lazy loading de rutas** | `loadComponent`/`loadChildren` por feature. Reduce bundle inicial. |
| **OnPush + signals** | Cambio de detección manual, menos ciclos de CD. |
| **Code splitting** | esbuild + lazy routes generan chunks por feature. |
| **Tree-shaking** | Imports nominales (`import { X } from 'rxjs'`, no `import * as`). |
| **Imágenes optimizadas** | `NgOptimizedImage` para imágenes de producto (lazy + responsive srcset). |
| **Compresión** | Nginx (en Dockerfile del frontend) con gzip/brotli. |
| **HTTP caching** | Headers cache-control en assets estáticos. |
| **Debounce de búsqueda** | `debounceTime(300)` en input de búsqueda → menos requests. |
| **Skeleton loaders** | Mejor LCP percibido vs spinner blanco. |
| **Defer blocks** | `@defer` para secciones below-the-fold. |

> Estas técnicas son la **evidencia práctica** del Ej. 4. El PDF teórico debe referenciarlas.

---

## Etapa 7 — Tests

**Objetivo:** cobertura mínima de componentes críticos.

- **Unit (Jest + Spectator)**:
  - `AuthStore`: login OK, login fail.
  - `ProductsStore`: load page, create, delete optimistic.
  - `ProductFormComponent`: validaciones.
- **e2e (Cypress)** *opcional*: happy path login → crear producto.

```bash
pnpm --filter frontend test
```

**Entregable:** [ ] commit `test(frontend): cobertura de stores y formularios`

---

## Etapa 8 — Build de producción + Dockerfile

**Objetivo:** imagen Nginx servida en `:4200`.

**`Dockerfile`** (multi-stage):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`nginx.conf`**:
- Fallback a `index.html` para SPA routing.
- Gzip habilitado.
- `Cache-Control` headers para assets con hash.
- Header `Content-Security-Policy` mínimo.

**Verificación:** `docker compose up frontend` → app accesible en `http://localhost:4200`.

**Entregable:** [ ] commit `chore(frontend): Dockerfile multi-stage + nginx`

---

## Definición de "Done" para el frontend

- [ ] Login + Register funcionan contra el gateway.
- [ ] CRUD de productos con tabla paginada operativa.
- [ ] State management vía NgRx Signal Store (no servicios con `BehaviorSubject` ad-hoc).
- [ ] Responsive verificado en 360px, 768px, 1280px.
- [ ] A11y: navegación por teclado, contraste, labels.
- [ ] Build de producción funciona desde Docker.
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95.
- [ ] No hay `any` no justificado en el código.
- [ ] Manejo de errores con toasts amigables (no `alert()`, no JSON crudo).

## Orden recomendado

1. Etapa 1 (bootstrap) — 30 min
2. Etapa 2 (core/interceptors) — 1h
3. Etapa 3 (auth) — 1.5h
4. Etapa 4 (productos) — 3h
5. Etapa 5 (responsive/a11y) — 1h
6. Etapa 6 (perf optimizations) — 30 min (algunas ya están)
7. Etapa 7 (tests) — 1h
8. Etapa 8 (docker) — 30 min

**Total estimado: 8-10h.**
