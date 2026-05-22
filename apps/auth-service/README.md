# @peaku/auth-service

Microservicio de autenticación: registro, login y rotación de refresh tokens.

> **Estado:** ✅ Etapa 2 completa. Use cases implementados, tests unitarios verdes.

## Endpoints (NestJS versioning v1)

| Método | Ruta | Descripción | Auth | Rate limit |
|--------|------|-------------|------|------------|
| POST | `/api/v1/auth/register` | Registra un usuario (bcrypt cost 12) | público | 5/min/IP |
| POST | `/api/v1/auth/login` | Login → devuelve access + refresh | público | 10/min/IP |
| POST | `/api/v1/auth/refresh` | Rota tokens (refresh token rotativo) | público | 20/min/IP |
| GET  | `/api/v1/auth/me` | Perfil del usuario actual | JWT | global |
| POST | `/api/v1/auth/logout` | Revoca refresh token actual | JWT | global |
| GET  | `/health` | Liveness probe | público | — |

## Estructura (Clean Architecture)

```
src/
├── domain/              # Entidades + interfaces (puertos) — sin deps externas
│   ├── user.entity.ts
│   ├── user.repository.ts          # port
│   ├── password-hasher.ts          # port
│   ├── token-service.ts            # port
│   └── errors.ts
├── application/         # Use cases (orquestación)
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   └── refresh.dto.ts
│   └── use-cases/
│       ├── register-user.use-case.ts
│       ├── login-user.use-case.ts
│       ├── refresh-token.use-case.ts
│       ├── get-current-user.use-case.ts
│       └── logout-user.use-case.ts
├── infrastructure/      # Adapters concretos
│   ├── persistence/
│   │   ├── user.schema.ts          # Mongoose schema
│   │   └── mongo-user.repository.ts
│   ├── security/
│   │   ├── bcrypt.hasher.ts        # implements PasswordHasher
│   │   └── jwt.token-service.ts    # implements TokenService
│   └── config/
│       └── env.validation.ts       # Joi schema
├── interface/           # HTTP layer
│   └── http/
│       ├── auth.controller.ts
│       ├── health.controller.ts
│       └── dtos/auth-response.dto.ts
└── common/
    ├── decorators/
    │   ├── public.decorator.ts     # marca rutas sin JWT
    │   └── current-user.decorator.ts
    ├── guards/
    │   └── jwt-auth.guard.ts       # APP_GUARD global
    ├── filters/
    │   └── all-exceptions.filter.ts # mapea errores de dominio → HTTP
    └── interceptors/
        └── correlation-id.interceptor.ts
```

## Seguridad implementada

- ✅ JWT HS256 con `algorithms: ['HS256']` explícito en verificación (mitiga ataques `alg=none`).
- ✅ Access token TTL 15 min, refresh TTL 7 días.
- ✅ Refresh token **rotativo** con hash en DB (revocable). Reutilizar refresh viejo → revoca toda la familia.
- ✅ Bcrypt cost 12 (configurable via env).
- ✅ Comparación de password **constant-time** dummy si el email no existe → mitiga timing attacks que revelen existencia del email.
- ✅ Rate limiting estricto en `/auth/login`, `/auth/register`, `/auth/refresh`.
- ✅ `passwordHash` y `refreshTokenHash` excluidos de toda respuesta JSON (transform en schema Mongoose).
- ✅ `mongoose.set('sanitizeFilter', true)` global → bloquea inyección de operadores.
- ✅ Validación estricta de DTOs (`whitelist: true, forbidNonWhitelisted: true`).
- ✅ Helmet, CORS por whitelist, ValidationPipe global.

## Correr

```bash
# Con Mongo levantado en :27017
pnpm --filter @peaku/auth-service start:dev
```

- API: `http://localhost:3001/api/v1/auth/...`
- Swagger: `http://localhost:3001/api/docs`

## Tests

```bash
pnpm --filter @peaku/auth-service test
```

Cubre: `RegisterUserUseCase`, `LoginUserUseCase` (happy + sad paths, normalización de email, timing-attack mitigation).
