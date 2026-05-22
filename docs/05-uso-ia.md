# 05 — Uso de Inteligencia Artificial

> Cumple con el requisito del PDF: documentar herramientas, prompts relevantes y cómo se validó/ajustó el output. **Este archivo refleja lo que realmente se usó**, no un plan previsto.

---

## 1. Herramientas utilizadas

| Herramienta | Uso real en este proyecto |
|---|---|
| **Claude Code (Anthropic)** — Opus 4.7 1M context | Asistente principal end-to-end: análisis del PDF, arquitectura, scaffolding backend + frontend, generación de DTOs/use cases/components, refactors, code reviews, debug, documentación. |
| **Google Stitch + MCP** (`@_davideast/stitch-mcp`) | Generación de mockups UI/UX visuales (login, register, lista de productos, form, versiones mobile) integrado a Claude Code vía Model Context Protocol. Los exports HTML/Tailwind viven en [`apps/frontend/stitch-exports/`](../apps/frontend/stitch-exports/) como single source of truth visual. |

Claude Code ofició también como **orquestador del MCP de Stitch** — los screens se generaban mediante prompts en español dentro de la misma conversación, se bajaban automáticamente al repo, y luego se implementaban como componentes Angular standalone.

---

## 2. Prompts y momentos clave

A continuación los prompts que **moldearon decisiones del proyecto**, no consultas triviales.

### 2.1 Análisis del PDF y decisiones iniciales

**Prompt:** *"Analiza este documento"* (con el PDF de la prueba adjunto).

**Output:** Claude resumió los 5 ejercicios, criterios de evaluación, alcance dentro/fuera, y propuso:
- Microservicios (en lugar de un monolito mínimo) — convierte el Ej. 1 en demo viva del Ej. 3.
- Angular 18+ con standalone + signals + NgRx Signal Store + Tailwind + Material.
- Documentación granular en `docs/00..06`.

**Validación humana:** lectura cruzada manual del PDF para verificar la interpretación. Rechazo de sugerencias sobre-ingenieriadas (ej. SSR). Aceptación tras confirmar que el alcance era realista para 20-30 horas.

### 2.2 Diseño visual con Stitch MCP

**Prompt:** *"Vamos a utilizar la conexión mediante MCP para conectar con Stitch para utilizar el potencial de esta plataforma para el diseño UI/UX de nuestro proyecto."*

**Flujo resultante:**
1. Configuración del MCP en `.mcp.json` (con varios intentos fallidos — la doc oficial original decía poner el server en `settings.local.json`, pero Claude Code en realidad lee MCP servers de `.mcp.json`).
2. Creación de un proyecto Stitch desde la sesión.
3. Definición del design system PeaKu en [`apps/frontend/DESIGN.md`](../apps/frontend/DESIGN.md): paleta agro (verde campo + ámbar cosecha + cream), tipografía Manrope/Inter/JetBrains Mono, anti-patterns explícitos (no `rounded-2xl`, no glassmorphism, no íconos decorativos).
4. Upload del DESIGN.md vía MCP → conversión a design system aplicable.
5. Generación de 6 screens (3 desktop + 3 mobile) con `generate_screen_from_text` aplicando el design system.
6. Descarga automática de HTML+screenshots a [`apps/frontend/stitch-exports/`](../apps/frontend/stitch-exports/).

**Validación:** revisión visual de cada preview antes de implementar. Comparación pixel-perfect con el resultado Angular usando un `<iframe>` lado a lado.

**Aprendizaje no obvio**: `generate_screen_from_text` con descripciones muy detalladas de imágenes genera **2 screens** — el UI codificable + un asset PNG separado. Hay que filtrar con `list_screens` para encontrar el que tiene `htmlCode.downloadUrl` populated. Documentado en la skill [`stitch-mcp-workflow`](../.claude/skills/stitch-mcp-workflow.md).

### 2.3 Bootstrap del frontend Angular

**Prompt:** *"Si vamos con el plan B incremental — bootstrap mínimo + Login primero — y después seguimos sumando."*

**Decisión clave**: **NO usar `ng new`**. Crear los archivos del bootstrap manualmente porque la carpeta `apps/frontend/` ya tenía contenido (DESIGN.md + stitch-exports) y `ng new` los hubiera escupido o requerido flags raros.

**Resultado:** Claude generó `package.json`, `tsconfig.json`, `angular.json`, `tailwind.config.ts`, `postcss.config.js`, `src/main.ts`, `src/index.html`, `src/styles.scss`, `_theme.scss`, `app.config.ts`, `app.routes.ts`, `app.component.ts`, `LoginPage` en una sola pasada. Build limpio en el primer intento tras un fix menor (orden de `@use` antes que `@tailwind` en Sass).

### 2.4 Auditoría de dependencias bloqueante (BLOCKING)

**Skill propia invocada:** [`dependency-security-check`](../.claude/skills/dependency-security-check.md) antes de cada `pnpm add`.

**Validaciones aplicadas**:
- Verificación de CVEs activos contra GitHub Security Advisories y Snyk DB.
- Edad de release ≥ 24h (cumple `minimum-release-age=1440` del `.npmrc`).
- Engines node compatibles.
- Provenance attestation firmada (keyid oficial npm registry).
- Estado de maintenance (deprecaciones, último commit).
- Transitivas contra la lista de overrides del proyecto.

**Hallazgo concreto**: `lucide-angular@1.0.0` estaba **deprecated** ("Package deprecated. Please use @lucide/angular instead"). Se cambió a `@lucide/angular@1.16.0` antes de tirar el `pnpm add`. Sin esta auditoría hubiera quedado una dep deprecated en el `package.json` desde el día 1.

### 2.5 Wire-up del JWT en frontend

**Prompt:** *"Vamos a hacer el login lo más profesional posible pero sin agregar más tiempo de implementación del que ya requiere y solicita la prueba."*

**Decisión:** scope estricto al **nivel B** de los 3 que Claude propuso:
- A (mínimo viable, solo Reactive Form + localStorage).
- **B (recomendado, con NgRx Signal Store + TokenStorageService).**
- C (bonus con interceptors + guard).

**Resultado intermedio**: B se implementó primero, después se agregó C en una iteración aparte cuando estuvo justificado por la primera ruta privada real (`/products`).

**Validación:** smoke test end-to-end vía `curl` + login real desde el browser + verificación de tokens en `sessionStorage` (DevTools F12).

### 2.6 DevTools de cambio de rol

**Prompt:** *"En vez de crear una nueva cuenta, podemos generar un panel de desarrollo que permita cambiar de rol, así las personas que evalúan la prueba pueden hacer el test con un solo usuario."*

**Resultado:** endpoint backend dev-only gated por env var (`ENABLE_DEV_TOOLS`), use case que rota tokens, controller en `auth-service`, proxy en `api-gateway`, y panel flotante en frontend que sólo se renderiza si `environment.production === false`.

**Validación end-to-end con curl**:
```
POST /api/v1/auth/dev/switch-role {role: 'admin'} → 200 + tokens
GET /api/v1/auth/me con nuevo bearer → role: 'admin' ✓
```

**Debug notable**: el primer test daba 404 porque el **API gateway no proxyaba el endpoint** (solo conocía los paths estándar `/login`, `/register`, etc.). Diagnóstico: leer logs de `auth-service`, hacer `curl` directo al puerto 3001 para distinguir si el problema era backend o gateway. Fix: agregar la route al `AuthProxyController` del gateway.

### 2.7 Code review automático (skill propia)

**Skill propia invocada:** [`code-quality`](https://github.com/anthropics/claude-code) al final del desarrollo:

> *"Audit completo del frontend Angular que armamos en esta sesión + revisión rápida de los cambios al backend"*

**Hallazgos categorizados**: 0 🔴 críticos, 3 🟡 importantes, 4 🟢 sugerencias.

Los 3 🟡 se aplicaron en una iteración corta (comentario stale en `auth.store.ts`, parser de error con contexto incorrecto en `switchRole`, redirect con `returnUrl` redundante). Verificado con `tsc --noEmit` (exit 0) + build (`pnpm --filter @peaku/frontend run build`).

---

## 3. Validación y rigor humano

### 3.1 Principios aplicados durante toda la sesión

1. **Lectura línea por línea** de cada bloque generado antes de aceptarlo. Si algo no se entendía, pregunta inmediata a Claude *por qué* lo escribió así.
2. **Compilar + smoke test después de cada cambio**: `pnpm --filter @peaku/<svc> run build` + `curl` al endpoint afectado.
3. **Auditoría de dependencias pre-install obligatoria** vía skill [`dependency-security-check`](../.claude/skills/dependency-security-check.md). Bloqueante: no se ejecuta `pnpm add` si hay 🔴.
4. **Cross-check con docs oficiales** para APIs nuevas: Angular Signal Store, NgRx `signalStore`, Stitch MCP — no se confió en patrones que la IA "recuerda".
5. **Skill `code-quality` antes de cerrar fases** para que Claude critique su propio output con criterios distintos.

### 3.2 Correcciones reales detectadas durante la sesión

| Error inicial de la IA | Corrección aplicada |
|---|---|
| `inject(DestroyRef).onDestroy(...)` dentro de `ngOnInit` (NG0203) | Mover el `inject()` a field initializer, pasar `this.destroyRef` explícito al `takeUntilDestroyed()` |
| `parseAuthError(err, 'login')` reusado para `switchRole` → copy engañoso ("Email o contraseña incorrectos" en un switch-role) | Extender el contexto a `'switch'` con mensajes específicos |
| Comentario JSDoc del `AuthStore` decía "interceptor y guard NO están implementados" después de que SÍ se implementaron | Reescribir el JSDoc para reflejar la realidad del repo y delegaciones a otros archivos |
| `returnUrl: router.url` redundante cuando la 401 venía del bootstrap → `?returnUrl=/login` inútil | Helper `redirectToLogin()` que filtra rutas auth/root antes de agregar el query param |
| Default del `DevToolsPanel.collapsed = false` → panel tapaba contenido en mobile al entrar | Cambiar a `signal(true)` + backdrop táctil para cerrar en mobile |
| MCP Stitch config en lugar erróneo (`.claude/settings.local.json`) | Mover el bloque `mcpServers` a `.mcp.json` (que es lo que Claude Code realmente lee) — diagnosticado leyendo logs de la extensión VS Code |
| Endpoint dev/switch-role daba 404 incluso con backend reiniciado | El gateway no proxyaba el path nuevo. Agregar al `AuthProxyController` |

### 3.3 Decisiones que NO se delegaron a IA

- **Alcance vs sobre-ingeniería**: cada feature pasó por un filtro humano "¿la prueba pide esto?". Se rechazaron sugerencias de Claude sobre Federation OAuth, multi-tenant, RabbitMQ, observability stack — la prueba no las pedía.
- **Storage de tokens**: Claude propuso `localStorage`. Decisión humana: `sessionStorage` (anti-XSS) con la advertencia de que lo ideal sería `httpOnly cookie` (fuera de scope).
- **Tabla HTML pura vs MatTable**: Claude propuso Material idiomático. Decisión humana: tabla HTML pura para mantener fidelidad pixel-perfect con el export Stitch aprobado, MatDialog sólo para el confirm de borrado donde Material aporta a11y real.
- **Lectura del PDF**: la IA resumió, pero la lectura cruzada manual fue del candidato.
- **Manejo de la API key de Stitch** y secrets `.env`: ninguno se compartió con la IA en texto plano cuando se discutió producción.
- **Review final pre-entrega**: el [PRE-ENTREGA-CHECKLIST.md](../PRE-ENTREGA-CHECKLIST.md) se ejecuta humanamente.

### 3.4 Skills personalizadas como "second opinion"

En [`.claude/skills/`](../.claude/skills/) se versionaron skills que Claude se autoinvoca según triggers:

| Skill | Cuándo se activa | Rol |
|---|---|---|
| `angular-clean-code` | Al escribir/editar Angular | Enforza Angular 18+ idioms (signals, OnPush, @if/@for, no `any`) |
| `nestjs-clean-code` | Al escribir/editar NestJS | Clean Architecture + DTOs + APP_GUARD JwtAuthGuard |
| `solid-review` | Auditoría SOLID | file:line + fix concreto |
| `security-audit` | OWASP API Top 10 | Defensa por capas |
| `dependency-security-check` | Antes de `pnpm add` | BLOCKING — sin esta validación, no se instala |
| `microservices-patterns` | Diseño de servicio | Límites + comunicación |
| `stitch-mcp-workflow` | UI/UX en Angular | Flujo Stitch ↔ Angular |

Estas skills evitaron la **drift entre sesiones** y aseguraron que el output de la IA fuera consistente con los estándares acordados al inicio.

---

## 4. Reflexión honesta

### Lo que la IA hizo bien

- **Generación de boilerplate** (DTOs, schemas Mongoose, componentes standalone Angular, módulos NestJS) en minutos.
- **Análisis cruzado de archivos**: detectó comentarios stale, código duplicado entre tabla desktop y cards mobile, parsers de error casi idénticos en auth y products.
- **Code review profundo** con la skill propia (3 issues 🟡 reales encontrados después del desarrollo).
- **Diseño visual asistido por Stitch MCP**: en ~30 minutos se generaron 6 mockups con design system propio aplicado, exportados como HTML auto-contenido. Comparado contra dibujar a mano en Figma, fue ~10× más rápido.

### Lo que requirió intervención humana constante

- **Acotar alcance**: la IA tiende a sobre-ingenierizar. Cada feature requirió un "pero la prueba sólo pide X". Esto se ve por ejemplo cuando se propusieron 3 niveles (A/B/C) para el login y se eligió B explícitamente.
- **Decisiones de seguridad**: la IA propone defaults razonables pero no conoce el contexto de amenazas real (ej: `sessionStorage` vs `localStorage` vs `httpOnly cookie`).
- **Debug de problemas raros**: el bug del MCP Stitch (config en archivo erróneo) tomó 4 iteraciones de diagnóstico humano + lectura de logs de VS Code.
- **Validación de prompts ambiguos**: cuando la consigna decía "API básica" hubo que clarificar humanamente si refería a monolito mínimo o si se podía mostrar microservicios.

### Conclusión

La IA actúa como **multiplicador de productividad**, no como reemplazo del criterio técnico. La calidad del output es directamente proporcional a:
1. La claridad del prompt (los prompts cortos y específicos generan mejores resultados que las consignas vagas).
2. El rigor del review humano (compilar + smoke test después de cada cambio, no acumular código sin validar).
3. La existencia de skills versionadas que evitan drift entre sesiones.

En esta prueba específica, el delivery time estimado **sin IA** rondaría las 40-50 horas (5-6 días de trabajo). Con IA + el setup descrito, **el delivery efectivo fue ~15-20 horas** distribuidas en sesiones de trabajo focalizado.
