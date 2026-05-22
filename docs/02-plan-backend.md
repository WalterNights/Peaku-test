# 02 — Plan de Acción · Backend

> Plan por etapas para implementar el backend (3 microservicios NestJS + MongoDB). Cada etapa es un hito verificable.

---

## 0. Pre-requisitos

- **Node.js ≥ 22.11 LTS** (Node 20 está EOL desde 2026-04-30)
- **pnpm ≥ 11.0** (soporta `minimumReleaseAge`, `allowBuilds`, `audit signatures` — claves para hardening de supply-chain, ver [`04-seguridad.md`](./04-seguridad.md) §13)
- Docker Desktop (con compose v2)
- MongoDB Compass (opcional, GUI)

## 1. Estructura del repo

Monorepo con **pnpm workspaces** (más simple que Nx para esta prueba, y suficiente):

```
PeaKu-prueba/
├── apps/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── products-service/
│   └── frontend/
├── libs/
│   └── shared/                 # DTOs y tipos compartidos (back ↔ front opcional)
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'libs/*'
```

---

## Etapa 1 — Scaffolding y tooling base

**Objetivo:** repo con los 3 servicios creados, lint/format unificados, docker-compose levanta Mongo.

**Pasos:**

1. `pnpm init -y` en raíz; configurar `pnpm-workspace.yaml`.
2. Para cada servicio: `nest new <name> --package-manager pnpm --strict`.
3. Configuración compartida en raíz:
   - **ESLint** flat config con `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-security`.
   - **Prettier** (`.prettierrc`).
   - **Husky + lint-staged** → corre lint/format en pre-commit.
   - **commitlint** con convención `conventional commits`.
4. `tsconfig.base.json` en raíz con `strict: true`, `noImplicitAny`, `noUncheckedIndexedAccess`, paths para `libs/shared`.
5. `docker-compose.yml` con:
   - `mongo-auth` (mongo:7) puerto 27017 → volumen `auth-data`.
   - `mongo-products` (mongo:7) puerto 27018 → volumen `products-data`.
   - Red `peaku-network`.
6. `.env.example` con todas las variables (sin valores reales).

**Verificación:**

```bash
docker compose up -d mongo-auth mongo-products
pnpm -r run build
```

Build verde en los 3 servicios.

**Entregable:** [ ] commit `chore: scaffolding inicial monorepo`

---

## Etapa 2 — Auth Service

**Objetivo:** `auth-service` corriendo en `:3001`, con register/login/refresh funcionando, tests pasando.

**Estructura interna** (Clean Architecture aplicada):

```
apps/auth-service/src/
├── domain/
│   ├── user.entity.ts
│   └── user.repository.ts          # port (interface)
├── application/
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   └── refresh.dto.ts
│   └── use-cases/
│       ├── register-user.use-case.ts
│       ├── login-user.use-case.ts
│       └── refresh-token.use-case.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── user.schema.ts          # Mongoose schema
│   │   └── mongo-user.repository.ts # implementa el port
│   ├── security/
│   │   ├── bcrypt.hasher.ts
│   │   └── jwt.token-service.ts
│   └── config/
│       └── env.validation.ts        # Joi/Zod schema para process.env
├── interface/
│   └── http/
│       ├── auth.controller.ts
│       └── dtos/
├── app.module.ts
└── main.ts
```

**Pasos:**

1. **Configuración**:
   - `@nestjs/config` con `validationSchema` (Joi o Zod).
   - Variables: `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`, `BCRYPT_ROUNDS=12`, `PORT=3001`.
2. **Mongoose**:
   - Schema `User` con `email` (índice único), `passwordHash`, `role`, `refreshTokenHash`, timestamps.
3. **Domain layer**:
   - `User` entity (sin Mongoose; objeto puro).
   - `UserRepository` interface con `findByEmail`, `save`, `updateRefreshToken`.
4. **Application layer**:
   - DTOs con `class-validator` (`@IsEmail`, `@IsStrongPassword`, `@MinLength`).
   - Use cases reciben `UserRepository`, `Hasher`, `TokenService` por DI.
5. **Infrastructure**:
   - `MongoUserRepository implements UserRepository`.
   - `BcryptHasher` (cost 12).
   - `JwtTokenService` (firma access + refresh).
6. **Interface (HTTP)**:
   - `POST /auth/register` → 201 `{ id, email }`.
   - `POST /auth/login` → 200 `{ accessToken, refreshToken }`.
   - `POST /auth/refresh` → 200 `{ accessToken }`.
   - `GET /auth/me` (protegido con `JwtAuthGuard`) → 200 `{ id, email, role }`.
7. **Seguridad**:
   - `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`.
   - Helmet, CORS configurado.
   - Throttler en `/auth/login`: 10 req/min/IP.
8. **Swagger**:
   - `SwaggerModule.setup('api/docs', app, doc)` con `addBearerAuth()`.
9. **Tests** (Jest):
   - Unit: `RegisterUserUseCase` con mock repo + hasher.
   - Unit: `LoginUserUseCase` (happy + invalid creds).
   - e2e: flujo register → login → refresh → me.

**Verificación:**

```bash
pnpm --filter auth-service test
pnpm --filter auth-service start:dev
# luego en otra terminal:
curl -X POST http://localhost:3001/auth/register -H "Content-Type: application/json" \
  -d '{"email":"a@a.com","password":"Pass1234!"}'
```

**Entregable:** [ ] commit `feat(auth): register/login/refresh con JWT`

---

## Etapa 3 — Products Service

**Objetivo:** `products-service` en `:3002` con CRUD completo, paginación, soft delete, Swagger.

**Estructura:** misma de Clean Architecture (espejo de auth-service).

**Pasos:**

1. **Schema Mongoose** `Product`:
   - `sku` (unique index), `name`, `description`, `price` (min 0.01), `stock` (min 0), `category`, `isActive`, `deletedAt`.
   - Índices: `{ sku: 1 }` unique, `{ category: 1 }`, `{ isActive: 1, deletedAt: 1 }`.
2. **DTOs**:
   - `CreateProductDto` (sku, name, price, stock, category, etc.).
   - `UpdateProductDto extends PartialType(CreateProductDto)`.
   - `ListProductsQueryDto` (`page=1`, `limit=20`, `category?`, `search?`, `sortBy?`).
3. **Use cases**:
   - `CreateProductUseCase`
   - `UpdateProductUseCase`
   - `DeleteProductUseCase` (soft delete)
   - `GetProductByIdUseCase`
   - `ListProductsUseCase` (paginado)
4. **Endpoints**:
   - `POST /products` (admin only)
   - `GET /products?page=1&limit=20&category=...&search=...` → `{ items, total, page, limit }`
   - `GET /products/:id`
   - `PATCH /products/:id` (admin only)
   - `DELETE /products/:id` (admin only)
5. **Autorización**:
   - `RolesGuard` + decorator `@Roles('admin')`.
   - Endpoints públicos (lectura): los GET — todos los usuarios autenticados.
   - Mutaciones (POST/PATCH/DELETE): solo `admin`.
6. **Sanitización** (defensa en capas — `express-mongo-sanitize` está deprecated y NO se usa, ver `04-seguridad.md` §13.4):
   - `mongoose.set('sanitizeFilter', true)` en `MongooseModule.forRootAsync` → envuelve user input en `$eq`.
   - DTOs estrictos con `class-validator` + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
   - Schemas Mongoose con `strict: true` (default).
7. **Paginación** robusta: usar el patrón `{ items, meta: { total, page, limit, totalPages } }`.
8. **Swagger** completo con ejemplos de request/response.
9. **Tests**:
   - Unit: cada use case con mock repository.
   - e2e: crear → listar → editar → eliminar (con token de admin mockeado).

**Verificación:**

```bash
pnpm --filter products-service test
curl http://localhost:3002/api/docs
```

**Entregable:** [ ] commit `feat(products): CRUD con paginación y soft delete`

---

## Etapa 4 — API Gateway

**Objetivo:** `api-gateway` en `:4050`, único endpoint expuesto; valida JWT y enruta.

**Pasos:**

1. **Auth guard global**:
   - Lee `Authorization: Bearer <token>`, verifica firma con `JWT_ACCESS_SECRET` (compartido con auth-service).
   - Inyecta `req.user = { sub, email, role }`.
   - Decorator `@Public()` para endpoints exentos (`/auth/*`).
2. **Routing**:
   - `/auth/*` → `auth-service:3001`.
   - `/products/*` → `products-service:3002`.
   - Usar `http-proxy-middleware` o módulo custom con `HttpModule`.
3. **Correlation-ID middleware**:
   - Si no viene `x-correlation-id`, generar uno (uuid).
   - Propagar al downstream y a logs.
4. **Helmet, CORS (whitelist), rate-limit global** (60 req/min/IP).
5. **Logger** (pino): cada request con `method, url, status, duration, correlationId`.
6. **Health check**: `GET /health` → 200 si el gateway está vivo.
7. **Swagger agregado** (opcional): aggregator que combina los OpenAPI de cada servicio en `/api/docs`.

**Verificación:**

```bash
docker compose up -d
curl -X POST http://localhost:4050/auth/login -H "Content-Type: application/json" \
  -d '{"email":"a@a.com","password":"Pass1234!"}'
# usar el token devuelto:
curl http://localhost:4050/products -H "Authorization: Bearer <TOKEN>"
```

**Entregable:** [ ] commit `feat(gateway): proxy + JWT guard + rate limit`

---

## Etapa 5 — Docker Compose y orquestación

**Objetivo:** `docker compose up` levanta todo el stack listo para que un revisor lo pruebe.

**`docker-compose.yml`** (resumen):

```yaml
services:
  mongo-auth:
    image: mongo:7
    volumes: [auth-data:/data/db]
    networks: [peaku]
  mongo-products:
    image: mongo:7
    volumes: [products-data:/data/db]
    networks: [peaku]
  auth-service:
    build: ./apps/auth-service
    env_file: .env
    depends_on: [mongo-auth]
    networks: [peaku]
  products-service:
    build: ./apps/products-service
    env_file: .env
    depends_on: [mongo-products]
    networks: [peaku]
  api-gateway:
    build: ./apps/api-gateway
    env_file: .env
    ports: ['4050:4050']  # único puerto expuesto
    depends_on: [auth-service, products-service]
    networks: [peaku]
  frontend:
    build: ./apps/frontend
    ports: ['4200:80']
    depends_on: [api-gateway]
    networks: [peaku]
networks:
  peaku:
volumes:
  auth-data:
  products-data:
```

**Dockerfile multi-stage** por servicio (builder + runtime con node:20-alpine).

**Entregable:** [ ] commit `chore: docker-compose con multi-stage builds`

---

## Etapa 6 — Tests y calidad

**Objetivo:** suite de tests pasando + coverage report.

- **Unit tests**: cada use case y guard.
- **Integration tests** (mongodb-memory-server) en `auth-service` y `products-service`.
- **e2e** mínimo: flujo completo login → crear producto → listar.
- Coverage objetivo: ≥ 70% en cada servicio.

```bash
pnpm -r test
pnpm -r test:cov
```

**Entregable:** [ ] commit `test: cobertura mínima en use cases`

---

## Etapa 7 — Documentación y pulido final

- README raíz con: arquitectura, cómo correr, endpoints principales, credenciales seed.
- Seed script: crea usuario admin (`admin@peaku.test` / `Admin1234!`) y 20 productos demo.
- Postman/Insomnia collection exportada en `docs/api/`.
- Verificar Swagger en `:4050/api/docs`, `:3001/api/docs`, `:3002/api/docs`.

**Entregable:** [ ] commit `docs: README + seeds + collection`

---

## Definición de "Done" para el backend

- [ ] `docker compose up` arranca sin errores.
- [ ] Swagger accesible en cada servicio.
- [ ] Tests verdes y coverage ≥ 70%.
- [ ] ESLint sin warnings.
- [ ] No hay secrets en código (verificado con `gitleaks` o revisión manual).
- [ ] README explica cómo correr y ejemplo de request.
- [ ] Endpoints retornan errores con formato consistente: `{ statusCode, message, error, correlationId }`.

## Orden recomendado de implementación

1. Etapa 1 (scaffolding) — 1h
2. Etapa 2 (auth) — 2-3h
3. Etapa 3 (products) — 2-3h
4. Etapa 4 (gateway) — 1-2h
5. Etapa 5 (docker) — 1h
6. Etapa 6 (tests) — 1-2h en paralelo
7. Etapa 7 (docs) — 30 min

**Total estimado: 8-12h** (depende de cuánto se delegue a IA).
