# @peaku/api-gateway

API Gateway: punto de entrada único de la plataforma. Valida JWT antes de proxear, aplica rate limiting, propaga `x-correlation-id` end-to-end y enruta a `auth-service` y `products-service`.

> **Estado:** ✅ Etapa 4 completa. Proxy operativo, JWT pre-validation, tests verdes.

## Endpoints expuestos (Swagger UI: `:4050/api/docs`)

### Auth (proxy → `auth-service:3001`)

| Método | Ruta | Auth | Rate limit |
|--------|------|------|------------|
| POST | `/api/v1/auth/register` | público | 5/min/IP |
| POST | `/api/v1/auth/login` | público | 10/min/IP |
| POST | `/api/v1/auth/refresh` | público | 20/min/IP |
| GET  | `/api/v1/auth/me` | JWT | global |
| POST | `/api/v1/auth/logout` | JWT | global |

### Products (proxy → `products-service:3002`)

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/v1/products` | JWT (admin enforcement en products-service) |
| GET  | `/api/v1/products` | JWT |
| GET  | `/api/v1/products/:id` | JWT |
| PATCH | `/api/v1/products/:id` | JWT (admin enforcement en products-service) |
| DELETE | `/api/v1/products/:id` | JWT (admin enforcement en products-service) |

### Otros

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/health` | público |

## Estructura (Clean Architecture sin DB)

```
src/
├── domain/
│   └── token-verifier.ts                  # port — sólo verify (no firma)
├── infrastructure/
│   ├── security/jwt.verifier.ts           # verifica con JWT_ACCESS_SECRET compartido
│   └── proxy/upstream.service.ts          # axios wrapper con propagación de headers
├── interface/http/
│   ├── auth-proxy.controller.ts           # endpoints explícitos con rate limits
│   ├── products-proxy.controller.ts       # endpoints explícitos con Swagger
│   └── health.controller.ts
└── common/
    ├── decorators/public.decorator.ts
    ├── guards/jwt-auth.guard.ts           # APP_GUARD global
    ├── filters/all-exceptions.filter.ts
    └── interceptors/correlation-id.interceptor.ts
```

No tiene `application/use-cases/` ni `persistence/` — el gateway **no tiene lógica de negocio**, sólo orquesta.

## Defensa en profundidad: gateway + servicios

El gateway **pre-valida** el JWT antes de proxear. Los servicios downstream **vuelven a verificar** el mismo token con el mismo secret (`JWT_ACCESS_SECRET` compartido). Razones:

1. **Performance**: 99% de los requests no autenticados los rechaza el gateway sin tocar Mongo.
2. **Seguridad**: si alguien alcanza la red interna saltando el gateway, los servicios siguen protegidos.
3. **Aislamiento de fallos**: si el gateway tuviera un bug de auth bypass, el daño no llega a Mongo.

Además se propaga `x-internal-api-key` (defensa adicional en redes internas) y `x-correlation-id` para trazabilidad end-to-end.

## Manejo de errores upstream

| Situación | Cliente recibe |
|-----------|---------------|
| Upstream responde 2xx | El gateway re-emite el body con el mismo status |
| Upstream responde 4xx | El gateway re-emite el body con el mismo status (transparente) |
| Upstream responde 5xx | El gateway re-emite el body con el mismo status |
| Upstream timeout / unreachable | El gateway responde **503 Service Unavailable** con correlation-id |

## Correr

```bash
# Con auth-service, products-service y los Mongos levantados
pnpm --filter @peaku/api-gateway start:dev
```

- Gateway: `http://localhost:4050/api/v1/...`
- Swagger: `http://localhost:4050/api/docs`

## Tests

```bash
pnpm --filter @peaku/api-gateway test
```

Cubre `UpstreamService`: propagación de headers (correlation-id + internal-api-key + authorization), forwarding transparente de 4xx, manejo de network errors → `ServiceUnavailableException`.
