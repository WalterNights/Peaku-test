# PeaKu — Prueba Técnica Full Stack

Implementación end-to-end de la prueba técnica para desarrollador Full Stack: arquitectura de microservicios con NestJS + MongoDB, SPA Angular 21 con NgRx Signal Store, JWT con refresh rotation, custom design system aplicado en Stitch + Angular, y CRUD completo de productos agropecuarios.

> **Estado**: 100% funcional. CRUD operativo, responsive desktop + mobile, autenticación con JWT, Swagger en los 3 servicios. Documentación teórica (Ej. 3, 4, 5) en [`docs/respuestas/`](./docs/respuestas/).

---

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | ≥ 22.22 LTS |
| Package manager | pnpm | 11.1.3 |
| Backend | NestJS + MongoDB (Mongoose) | 11.x + 8.9.5 |
| Frontend | Angular standalone + signals + zoneless | 21.2 |
| State management | NgRx Signal Store | 21.1 |
| UI | Tailwind CSS + Material Symbols + custom design system | 3.4 |
| Auth | JWT access (15min) + refresh (7d) con rotación | — |
| Docs API | Swagger / OpenAPI por servicio | — |
| Infra dev | Docker Compose | — |

## Arquitectura

```
Browser ──► Frontend Angular (4200)
              │
              ▼ HTTPS + JWT Bearer
           API Gateway (4050) ──► valida JWT, rate-limit, CORS, helmet, correlation-id
              │
              ├──► Auth Service (3001) ──► Mongo auth-db (27017)
              └──► Products Svc (3002) ──► Mongo products-db (27018)
```

Detalle completo en [`docs/01-arquitectura.md`](./docs/01-arquitectura.md).

---

## Quickstart

### Pre-requisitos

- **Node.js ≥ 22.22 LTS** (`node --version`)
- **pnpm ≥ 11.1** (instalación: `corepack enable && corepack prepare pnpm@11.1.3 --activate`)
- **Docker Desktop** corriendo (lo usa `pnpm dev` para levantar los Mongos en containers — los servicios NestJS y el frontend Angular corren nativos en tu host)

### Setup (una sola vez, ~3-5 min)

```bash
# 1. Clonar
git clone https://github.com/WalterNights/Peaku-test.git
cd Peaku-test

# 2. Crear .env desde el template
cp .env.example .env

# 3. Generar dos JWT secrets fuertes y reemplazar en .env
#    (línea JWT_ACCESS_SECRET y JWT_REFRESH_SECRET — deben ser DIFERENTES entre sí)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
#    Copiar cada output y pegarlos en .env reemplazando los CHANGE_ME_...

# 4. Instalar dependencias (puede tardar 2-3 min la primera vez)
pnpm install
```

**Nota sobre el `.env`**: las passwords de Mongo del `.env.example` (`changeme_auth_strong_password`, etc.) funcionan en local sin tocarlas. Lo único **obligatorio** de cambiar son los dos `JWT_*_SECRET` — el backend valida al boot que sean ≥ 32 chars y aborta si están en `CHANGE_ME_...`.

### Levantar TODO el stack (1 comando)

```bash
pnpm dev
```

Esto arranca **5 procesos en paralelo** (los logs de cada uno aparecen prefijados por color en la misma terminal):

| Proceso | Puerto | URL | Logs esperados |
|---|---|---|---|
| `MONGO` (containers Docker) | 27017, 27018 | — | "Waiting for connections" |
| `AUTH` (auth-service) | 3001 | http://localhost:3001/api/docs | `[Nest] Started in XXms` |
| `PROD` (products-service) | 3002 | http://localhost:3002/api/docs | `[Nest] Started in XXms` |
| `GW` (api-gateway, **público**) | **4050** | http://localhost:4050/api/docs | `[Nest] Started in XXms` |
| `FRONT` (Angular dev server) | **4200** | http://localhost:4200 | `Local: http://127.0.0.1:4200/` |

**Listo cuando ves los 5 mensajes** (toma ~30-60s la primera vez). Abrí http://localhost:4200 en el browser.

`Ctrl+C` baja todo limpio (mata procesos + containers vía `concurrently -k` + `pnpm kill`).

### Errores comunes al arrancar

| Síntoma | Causa | Solución |
|---|---|---|
| `Error: connect ECONNREFUSED 127.0.0.1:27017` | Docker no está corriendo | Abrí Docker Desktop y reintentá |
| `JWT_ACCESS_SECRET must be at least 32 characters` | No reemplazaste los `CHANGE_ME_*` del `.env` | Generá secrets con `node -e "..."` (ver Setup) |
| `EADDRINUSE: address already in use :::4050` | Otro proceso ocupa los puertos | `pnpm kill` mata los del proyecto. Si es otro proyecto, ver Troubleshooting más abajo |
| `pnpm dev` queda colgado en "Building peaku" | Primera compilación de TS, normal | Esperá ~30s adicionales |

### Cargar datos demo (una sola vez)

```bash
pnpm seed
```

Crea:
- 1 admin demo (ver tabla abajo).
- 10 productos agropecuarios reales (soja, maíz, trigo, girasol, cebada, sorgo, alfalfa, avena, colza, moha) en categorías `cereales | oleaginosas | forrajeras`.

Es **idempotente**: re-correrlo skip-ea lo que ya existe.

---

## Cómo evaluar la app

### Cuentas demo

| Cuenta | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@peaku.test` | `Admin1234!` | `admin` (puede crear/editar/eliminar) |
| User normal | crear desde `/register` o usar dev-tools (ver abajo) | — | `user` (solo lectura) |

### 🛠 Dev Tools — cambio de rol en vivo

En desarrollo (no production), un panel flotante en la esquina inferior derecha (el botón redondo 🛠) permite **alternar el rol del user logueado entre `user` y `admin`** sin re-loguearse. Pensado para que el evaluador pruebe la app desde ambas perspectivas con un solo usuario.

Click 🛠 → tap **User** o **Admin** → los tokens se rotan en backend y el frontend se actualiza en vivo (botones de Nuevo/Editar/Eliminar se habilitan/deshabilitan al toque).

El endpoint sólo se monta si `ENABLE_DEV_TOOLS !== 'false'` (default true en dev). En production real se setea `ENABLE_DEV_TOOLS=false` y el controller literalmente no existe.

### Flujo end-to-end recomendado

1. Abrir http://localhost:4200 → te redirige a `/login`.
2. Login con `admin@peaku.test` / `Admin1234!`.
3. Lista de productos con paginación, búsqueda, filtro por categoría.
4. **Click + Nuevo producto** → form en `/products/new` con validaciones espejo del backend.
5. **Click ✏️ Editar** → form pre-cargado en `/products/:id/edit`.
6. **Click 🗑** → `MatDialog` de confirmación → delete soft.
7. **Logout** desde el dropdown del avatar → vuelve a `/login`.
8. **Crear cuenta** desde `/register` (form con validaciones, indicador de fuerza de password, confirm match).
9. **Responsive**: F12 → toggle device toolbar (Ctrl+Shift+M) → recorrer en mobile (tabla → cards, hero arriba en login/register, paginador simplificado).

### Probar con curl

```bash
# Login
curl -X POST http://localhost:4050/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@peaku.test","password":"Admin1234!"}'

# Listar productos (usar accessToken del response anterior)
curl http://localhost:4050/api/v1/products \
  -H "Authorization: Bearer <accessToken>"

# Crear (admin only)
curl -X POST http://localhost:4050/api/v1/products \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"sku":"TEST-001","name":"Producto demo","price":100,"stock":50,"category":"otros"}'
```

Colección Postman lista para correr en [`docs/api/`](./docs/api/) (63 tests automatizados).

---

## Cómo correr con Docker

```bash
pnpm docker:up       # build + levanta los 3 services + Mongos en containers
pnpm seed            # carga datos demo (idempotente)
pnpm docker:logs     # ver logs en vivo
pnpm docker:down     # baja todo
pnpm docker:reset    # bonus: borra volúmenes + rebuild + reseed
```

Validado: el `pnpm deploy` interno + multi-stage Dockerfile genera imágenes ~120MB por servicio.

---

## Cleanup si algo quedó colgado

```bash
pnpm kill   # mata SOLO procesos del proyecto PeaKu (identificados por cmdline) + docker compose down
```

El script ([`scripts/kill-stack.cjs`](./scripts/kill-stack.cjs)) chequea cada PID en los puertos `27017, 27018, 3001, 3002, 4050, 4200` y mata sólo los procesos cuya command line contiene markers PeaKu (`@peaku/`, `dev-service.cjs`, path del repo). Preserva procesos foráneos (otro proyecto, Docker, etc.).

---

## Estructura del repositorio

```
PeaKu-prueba/
├── apps/
│   ├── api-gateway/             # NestJS — único ingress público
│   ├── auth-service/            # NestJS — JWT, register, login, refresh, me, logout
│   ├── products-service/        # NestJS — CRUD productos con roles
│   └── frontend/                # Angular 21 standalone + signals + zoneless
│       ├── DESIGN.md            # Single source of truth visual (paleta, tipografía, components)
│       ├── stitch-exports/      # HTML+previews mockups de Google Stitch (desktop + mobile)
│       └── src/app/
│           ├── core/            # interceptors, guards, services globales
│           ├── features/        # auth + products (con data, store, util, pages)
│           └── shared/          # ui reusable (ConfirmDialog) + dev-tools
├── libs/
│   └── shared/                  # types/constants compartidos (UserPublic, ProductCategory, etc.)
├── docs/                        # Toda la doc del proyecto
│   ├── 00..06 ...md             # Análisis, arquitectura, planes, seguridad, IA, Swagger
│   ├── respuestas/              # Ej. 3, 4, 5 teóricos (entregable PDF)
│   ├── api/                     # Colección Postman + environment
│   └── Prueba_Tecnica_FullStack.pdf
├── scripts/                     # dev-service.cjs, kill-stack.cjs
├── .claude/skills/              # Skills personalizadas (clean code, security, etc.)
├── docker-compose.yml
├── pnpm-workspace.yaml          # con allowBuilds whitelist (supply-chain hardening)
└── README.md
```

---

## Documentación

| # | Documento | Contenido |
|---|-----------|-----------|
| 00 | [Análisis de la prueba](./docs/00-analisis-prueba.md) | Lectura del PDF, decisiones, alcance, riesgos |
| 01 | [Arquitectura](./docs/01-arquitectura.md) | Microservicios, SOLID, clean architecture, diseño extendido agro (Ej. 3) |
| 02 | [Plan Backend](./docs/02-plan-backend.md) | Etapas implementación NestJS |
| 03 | [Plan Frontend](./docs/03-plan-frontend.md) | Etapas implementación Angular + flujo Stitch MCP |
| 04 | [Seguridad](./docs/04-seguridad.md) | JWT, OWASP API Top 10, MongoDB hardening, supply-chain, despliegue cloud (Ej. 5) |
| 05 | [Uso de IA](./docs/05-uso-ia.md) | Herramientas, prompts reales, validaciones aplicadas |
| 06 | [Swagger / OpenAPI](./docs/06-swagger.md) | Estándar de documentación de la API |
| — | [Respuestas teóricas](./docs/respuestas/) | Ej. 3 (microservicios), Ej. 4 (performance), Ej. 5 (seguridad). **Entregable PDF** |

### Skills Claude (en `.claude/skills/`)

| Skill | Cuándo se activa |
|-------|-----------------|
| [`angular-clean-code`](./.claude/skills/angular-clean-code.md) | Al escribir/revisar código Angular (signals, OnPush, standalone, a11y) |
| [`nestjs-clean-code`](./.claude/skills/nestjs-clean-code.md) | Al escribir/revisar código NestJS (Clean Architecture + DTOs + seguridad) |
| [`solid-review`](./.claude/skills/solid-review.md) | Auditoría SOLID con file:line + fix concreto |
| [`security-audit`](./.claude/skills/security-audit.md) | Checklist OWASP API Top 10 + post-install audit |
| [`dependency-security-check`](./.claude/skills/dependency-security-check.md) | **BLOCKING** pre-install audit (CVEs + provenance + release age) |
| [`microservices-patterns`](./.claude/skills/microservices-patterns.md) | Diseño/review de límites de servicio |
| [`stitch-mcp-workflow`](./.claude/skills/stitch-mcp-workflow.md) | Flujo Google Stitch → Angular via MCP |

---

## Troubleshooting

### Puerto ocupado por otro proyecto

`pnpm dev` no mata procesos foráneos por seguridad. Si un proceso de otro proyecto ocupa los puertos `3001/3002/4050/4200/27017/27018`, matalo a mano:

```bash
# Identificar:
netstat -ano | findstr LISTENING | findstr ":3001 "

# Matar:
taskkill /F /PID <PID>
```

### Cambios al backend no se reflejan

`nest start --watch` a veces no detecta cambios en monorepos pnpm Windows. Fix:

```bash
# Mata el proceso del service que no recargó:
taskkill /F /PID <PID-del-puerto>
# pnpm dev lo re-spawnea con el código nuevo.
# Si no, reinicio limpio total:
pnpm kill && pnpm dev
```

### Endpoint `/v1/auth/...` da 404

El gateway expone con prefix `/api/v1/auth/...`, no `/v1/auth/...`. Ver Swagger en http://localhost:4050/api/docs para los paths exactos.

---

## Criterios de evaluación

| Criterio | Estado | Evidencia |
|---|---|---|
| Calidad y estructura de código | ✅ | SOLID + Clean Architecture + 0 `any` + TypeScript strict + 7/7 componentes OnPush + lazy routes |
| Backend funcional | ✅ | 3 microservicios + JWT + Swagger + 9 endpoints + 9 tests passing |
| Frontend funcional | ✅ | CRUD completo + tabla paginada + búsqueda + filtros + responsive (desktop/mobile) |
| Buenas prácticas seguridad | ✅ | JWT con refresh rotation + interceptors + sessionStorage anti-XSS + rate limit + helmet + supply-chain hardening (`minimum-release-age=1440`) |
| Rendimiento | ✅ | Lazy load por feature + zoneless CD + signals + OnPush + tree-shaking + ~108kB gzip initial |
| Claridad en arquitectura | ✅ | Diagrama + 7 docs + skills versionadas |
| Uso consciente de IA | ✅ | [docs/05-uso-ia.md](./docs/05-uso-ia.md) con prompts reales + validaciones aplicadas |
| Capacidad de explicación | ✅ | Cada decisión justificada en `docs/` |
