# Colección Postman — PeaKu API

Colección lista para probar el backend de PeaKu end-to-end, con **tests automatizados** que validan status codes, shapes de respuesta, autorización por rol, manejo de errores y propagación de correlation-id.

## Archivos

- [`peaku.postman_collection.json`](./peaku.postman_collection.json) — la colección con 7 grupos y 28+ requests, cada uno con tests embebidos.
- [`peaku.postman_environment.json`](./peaku.postman_environment.json) — variables del environment (`baseUrl`, credenciales, tokens, IDs).

## Pre-requisitos

```bash
# 1. Stack del backend corriendo
pnpm docker:up

# 2. Datos demo cargados (admin + 10 productos)
pnpm seed
```

Verificá que el gateway responde:

```bash
curl http://localhost:4050/health
# → {"status":"ok","service":"api-gateway","timestamp":"..."}
```

## Opción A — desde la app de Postman (GUI)

1. **File → Import** y arrastrá los 2 JSON.
2. Arriba a la derecha, seleccioná el environment **"PeaKu — Local"**.
3. **Collections → PeaKu API → ⋯ → Run collection**.
4. Marcá "Save responses" si querés ver el body de cada request.
5. Click **Run PeaKu API**.

Debería terminar con ~70 tests en verde, en orden secuencial.

## Opción B — desde la CLI con Newman (recomendado para CI/CD)

[Newman](https://github.com/postmanlabs/newman) es el runner CLI oficial de Postman.

### Instalar

```bash
# Global
npm install -g newman newman-reporter-htmlextra

# O efímero (sin instalar)
npx newman run docs/api/peaku.postman_collection.json \
  -e docs/api/peaku.postman_environment.json
```

### Correr la suite completa

```bash
newman run docs/api/peaku.postman_collection.json \
  -e docs/api/peaku.postman_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export docs/api/last-run-report.html
```

El reporte HTML queda en `docs/api/last-run-report.html` — útil para adjuntar a la entrega.

### Solo un grupo (ej. auth happy path)

```bash
newman run docs/api/peaku.postman_collection.json \
  -e docs/api/peaku.postman_environment.json \
  --folder "1. Auth — Happy Path"
```

### Como gate de CI/CD

```bash
# Falla con exit code != 0 si algún test rojo
newman run docs/api/peaku.postman_collection.json \
  -e docs/api/peaku.postman_environment.json \
  --bail
```

## Estructura de la colección

| # | Folder | Cubre | Tests |
|---|--------|-------|-------|
| 0 | **Health** | `GET /health` | 4 |
| 1 | **Auth — Happy Path** | register, login (admin + user), me, refresh con rotación | ~14 |
| 2 | **Auth — Sad Path** | duplicate email (409), invalid email (400), wrong password (401), nonexistent email (401, no leak), no token, invalid token | ~12 |
| 3 | **Products — Public Reads** | list paginado, filter por categoría, search, get by ID, 404, sin token (401) | ~14 |
| 4 | **Products — Admin Mutations** | create (201), duplicate SKU (409), invalid price (400), PATCH (200), tentativa de cambiar SKU (400 forbidNonWhitelisted), DELETE soft (204), get después de delete (404) | ~14 |
| 5 | **Authorization Failures** | `user` intentando crear/borrar productos (403) | 2 |
| 6 | **Logout & Token Revocation** | logout (204), refresh con token revocado (401) | 2 |

## Lo que validan los tests

Más allá de los status codes, los tests verifican propiedades **funcionales y de seguridad**:

- ✅ **Sin leak de password**: `passwordHash` y `refreshTokenHash` nunca aparecen en respuestas.
- ✅ **Sin leak de existencia**: login con email inexistente y login con password mal devuelven el **mismo error** y mensaje genérico (mitiga timing/oracle attacks).
- ✅ **Rotación de refresh tokens**: después de `/auth/refresh`, los tokens nuevos son distintos a los viejos.
- ✅ **Revocación efectiva**: tras `/auth/logout`, el refresh token previo da 401.
- ✅ **Autorización por rol**: un user con `role: user` no puede ejecutar mutaciones de productos (403, no 401).
- ✅ **SKU inmutable**: PATCH con `sku` en el body falla con 400 (gracias a `forbidNonWhitelisted` del DTO).
- ✅ **Soft delete**: producto borrado deja de aparecer en `GET /products/:id`.
- ✅ **JWT claims correctos**: `iss`, `aud`, `role` están presentes y son válidos.
- ✅ **Correlation-id**: cada response incluye el header `x-correlation-id` (propagado por gateway → services).

## Variables del environment

Las que se setean automáticamente durante la corrida:

| Variable | Setea | Usa |
|----------|-------|-----|
| `accessToken` | `/auth/login` (admin) | Todas las requests admin |
| `refreshToken` | `/auth/login` (admin) | `/auth/refresh` |
| `userAccessToken` | `/auth/login` (user) | Tests de 403 (intento de mutación) |
| `createdProductId` | `POST /products` | PATCH, GET, DELETE posteriores |
| `createdProductSku` | `POST /products` | Validar SKU inmutable en PATCH |

## Reset / re-correr

La collection es **idempotente**:

- Register del test user puede dar 409 si ya existe — el test lo acepta.
- Si el seed cambia los IDs de productos, el primer test `GET /products` captura uno nuevo.
- El POST de producto E2E genera un SKU con timestamp (siempre único).

Para limpiar entre corridas (opcional):

```bash
docker compose down -v && docker compose up -d --build && pnpm seed
```

## Troubleshooting

| Error | Causa | Fix |
|-------|-------|-----|
| `ECONNREFUSED 127.0.0.1:4050` | Stack apagado | `pnpm docker:up` |
| `401` en /auth/me | Token expiró (15 min TTL) | Re-correr `POST /auth/login` |
| `409` en POST seed admin | Ya existe — esperable | Ignorable |
| Tests de "soja" search 0 matches | Seed no corrió | `pnpm seed` |
| `403` en POST /products con admin | Token viejo, login antes del seed admin | Re-correr login |
