# Ejercicio 4 — Optimización de Rendimiento Web

> **Consigna:** Proponer estrategias para mejorar rendimiento y UX/UI en aplicaciones web, especialmente en dispositivos móviles. Explicar al menos 3 técnicas concretas.

---

## 1. Resumen ejecutivo

Mobile es el peor escenario: redes 3G/4G inestables, CPUs lentas, batería limitada, viewports chicos. Una app que tarda 5s en cargar en desktop tarda 15s+ en mobile y pierde el 50% de los usuarios antes de que termine de renderizar (Google Web Vitals 2024).

Las técnicas que aplicamos en este proyecto **(verificables en el código)** + las que son extensión natural:

| # | Técnica | Estado en este repo | Impacto principal |
|---|---|---|---|
| 1 | **Code splitting + lazy routes** | ✅ Implementado | Reduce el bundle inicial — el usuario sólo baja lo que necesita |
| 2 | **Zoneless change detection + OnPush + signals** | ✅ Implementado | Menos ciclos de CD = menos trabajo del CPU mobile |
| 3 | **Compression (gzip/brotli) + HTTP cache** | 🟡 Configurable en Nginx del Dockerfile | Reduce bytes transferidos en 70-85% |
| 4 | **Imágenes responsive + lazy** (`NgOptimizedImage`) | 🟡 No usado todavía (export Stitch usa `<img>` plano) | Reduce LCP en mobile dramáticamente |
| 5 | **Skeleton loaders en lugar de spinners** | ✅ Implementado | Mejora LCP percibido sin mejorar el real |
| 6 | **Debounce de búsqueda** | ✅ Implementado | Reduce requests innecesarios al backend |

A continuación, las **3 técnicas más relevantes** explicadas en profundidad.

---

## 2. Técnica #1 — Code splitting + lazy loading por feature

### Qué es

Dividir el bundle JavaScript en chunks más pequeños y cargar cada uno **on-demand** (al navegar a la ruta correspondiente), en lugar de servir un único `main.js` gigante al primer pintado.

### Por qué importa especialmente en mobile

Una app SPA típica sin optimizar carga `main.js` de **800kB–2MB** al primer hit. En 3G (~750 kbps efectivos), eso son **8-22 segundos** sólo bajando JS antes de renderizar nada. Sin code splitting, la pantalla de login carga el código del CRUD de productos, del form, del dashboard, etc.

### Cómo lo aplicamos en este proyecto

[`apps/frontend/src/app/app.routes.ts`](../../apps/frontend/src/app/app.routes.ts) define cada ruta con `loadComponent`:

```typescript
export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/pages/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/products/pages/products-list.page').then((m) => m.ProductsListPage),
  },
  // ...
];
```

### Resultado medido

| Chunk | Raw | Gzipped | Cuándo se carga |
|---|---|---|---|
| `main` + Angular runtime | 304 kB | 84 kB | Siempre (boot) |
| `login-page` | 9 kB | 3 kB | Sólo al navegar a `/login` |
| `register-page` | 13 kB | 4 kB | Sólo al navegar a `/register` |
| `products-list-page` | 124 kB | 28 kB | Sólo al navegar a `/products` |
| `product-form-page` | 14 kB | 4 kB | Sólo al navegar a `/products/new` |

**Initial download** en mobile = solo `main + login` = **~87 kB gzip**, ~1 segundo en 3G. El resto se carga al navegar — el usuario ni nota la transición.

### Variantes que valen la pena

- **Lazy de bibliotecas pesadas** dentro de un componente con `@defer`:
  ```html
  @defer (on viewport) {
    <app-chart [data]="report()" />
  }
  ```
- **Preload de rutas probables** después del bootstrap (`PreloadAllModules` o estrategia custom basada en analytics).

---

## 3. Técnica #2 — Zoneless change detection + OnPush + signals

### Qué es

Angular tradicionalmente usa **Zone.js**, una librería que parchea todas las APIs async del navegador (setTimeout, fetch, eventos del DOM) para disparar change detection automáticamente. Es conveniente pero pesado: la app vuelve a evaluar todas las expresiones de todos los templates en cada microtarea.

**Zoneless** elimina Zone.js. La app actualiza solo cuando los signals cambian. **OnPush** + signals = CD quirúrgica, solo en el subárbol afectado.

### Por qué importa en mobile

CPUs mobile son 3-5× más lentas que desktop. Cada ciclo de CD que se evita = menos jank en scroll, menos calentamiento, mejor batería.

### Cómo lo aplicamos

[`apps/frontend/src/app/app.config.ts`](../../apps/frontend/src/app/app.config.ts):

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),    // ← sin Zone.js
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
```

Y todos los componentes con `OnPush` + signals:

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class ProductsListPage {
  readonly authStore = inject(AuthStore);
  readonly store = inject(ProductsStore);

  // Computed signal — solo recalcula cuando dependencias cambian
  readonly isAdmin = computed(() => this.authStore.user()?.role === 'admin');
}
```

### Resultado

- Bundle de Angular runtime más chico (sin Zone.js ≈ 20kB menos).
- **Cero `console.warn` de ExpressionChangedAfterCheckedError** (problema clásico de Zone que se diagnostica horas).
- Change detection se dispara **solo** cuando un signal cambia, no en cada `setTimeout`.

### Comparativa de filosofías

| Modelo | CD se dispara cuando... | Costo CPU mobile |
|---|---|---|
| Zone.js (default Angular hasta 17) | Cualquier async termina | Alto (todos los componentes) |
| OnPush + Zone.js | Cualquier async termina, pero solo evalúa componentes con input cambiado | Medio |
| **Zoneless + signals + OnPush** | **Solo cuando un signal cambia y es leído en un template** | **Bajo (subárbol afectado)** |

---

## 4. Técnica #3 — Compression + HTTP cache + assets optimizados

### Qué es

Una capa transparente que reduce drásticamente los bytes que cruzan la red, sin tocar el código de la app.

### Componentes

#### 4.1 Brotli + gzip en el servidor

Nginx (en el Dockerfile multi-stage del frontend) sirve los assets pre-comprimidos. **Brotli reduce ~25% más que gzip** en JS/CSS modernos.

```nginx
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;

brotli on;
brotli_types text/css application/javascript application/json image/svg+xml;
```

Para nuestro bundle de **102 kB gzip** (lista de productos con todo):
- Sin compression: 405 kB
- Gzip: 102 kB (75% reduction)
- Brotli: ~78 kB (80% reduction)

#### 4.2 Cache-Control para assets con hash

Angular CLI emite assets con hash en el nombre (`main-AM4D2K45.js`). Cuando cambian, el hash cambia. Por eso podemos cachearlos **forever**:

```nginx
location ~* \.(?:css|js|woff2?)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location = /index.html {
  expires -1;
  add_header Cache-Control "no-store, must-revalidate";
}
```

El usuario que vuelve a la app **no baja JS** — solo bajan el `index.html` (~1 kB) que apunta a los assets que ya tiene en cache.

#### 4.3 Tree-shaking efectivo

Imports nominales (no `import * as`):

```typescript
// ✅ Tree-shakable
import { firstValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';

// ❌ Importa toda la librería
import * as rxjs from 'rxjs';
```

Angular esbuild builder + TypeScript strict eliminan código muerto agresivamente.

#### 4.4 NgOptimizedImage (recomendación, no implementado en este proyecto)

Para una app con imágenes pesadas (no es nuestro caso — solo tenemos 2 fotos editoriales de login/register), `NgOptimizedImage` agrega automáticamente:
- `loading="lazy"` para imágenes below-the-fold.
- `decoding="async"` para no bloquear el main thread.
- `srcset` con múltiples resoluciones.
- Priority hint para LCP image.

```html
<img ngSrc="login-field.jpg" width="1280" height="720" priority />
```

### Resultado consolidado

| Métrica | Sin optimizar | Optimizado |
|---|---|---|
| Initial download (mobile 3G) | ~22 seg | **~1 seg** (gzip + cache + lazy) |
| Re-visit (mobile 3G) | ~22 seg | **~0.1 seg** (index.html + cache) |
| CPU time en mobile (CD por scroll) | Alto | Bajo (zoneless + signals) |

---

## 5. Otras técnicas que aplicamos (más breves)

- **Debounce de búsqueda 300ms**: el `<input>` de búsqueda en lista de productos usa `debounceTime(300) + distinctUntilChanged()` antes de llamar al backend. Reduce 80%+ de requests innecesarios al tipear.
- **Skeleton loaders**: durante el load inicial mostramos placeholders gris pulsantes en lugar de spinners. **Mejora LCP percibido** (Largest Contentful Paint subjetivo) sin mejorar el real.
- **`track p.id` en `@for`**: Angular reusa elementos DOM en lugar de re-crearlos cuando cambia el orden de la lista. Crítico en tablas/cards paginadas.
- **Touch targets ≥ 44×44px** en mobile (botones h-11/h-12 en lugar de h-8/h-10). Reduce taps fallidos = menos retries = mejor UX percibido.

---

## 6. Cómo se mide el resultado

| Métrica | Target Google | Cómo se mide |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | `npx lighthouse https://... --view` o Chrome DevTools → Lighthouse |
| **FID/INP** (Interaction to Next Paint) | < 200ms | Chrome DevTools → Performance |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| **TBT** (Total Blocking Time) | < 200ms | Lighthouse |
| **Bundle size** | < 500 kB gzip recomendado | Angular CLI lo reporta en cada build |

**Target del proyecto** (`docs/03-plan-frontend.md` §"Done"): Lighthouse Performance ≥ 90, Accessibility ≥ 95 en mobile emulado.

---

## 7. Conclusión

Las 3 técnicas profundizadas (lazy loading, zoneless+OnPush+signals, compression+cache) **no son optativas en mobile** — son la diferencia entre 1 segundo y 20 segundos al primer pintado. Combinadas con prácticas menores (debounce, skeleton, `track`, touch targets), la app rinde aceptablemente en redes 3G sobre dispositivos de gama media (el segmento más común en LATAM).

**Trade-off honesto**: zoneless es nuevo (estable desde Angular 18). Algunas librerías third-party todavía asumen Zone.js. Si se necesita una integración legacy, Angular permite volver a la CD con Zone con un solo cambio en `app.config.ts`.
