# @peaku/products-service

Microservicio del catálogo de productos: CRUD con paginación, soft-delete, validaciones y autorización por rol.

> **Estado:** ✅ Etapa 3 completa. Use cases implementados, tests unitarios verdes.

## Endpoints (NestJS versioning v1)

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/products` | Crear producto | JWT + rol `admin` |
| GET  | `/api/v1/products` | Listar paginado (filtros: `page`, `limit`, `category`, `search`, `includeInactive`) | JWT |
| GET  | `/api/v1/products/:id` | Obtener por ID | JWT |
| PATCH | `/api/v1/products/:id` | Actualizar (SKU NO se puede cambiar) | JWT + rol `admin` |
| DELETE | `/api/v1/products/:id` | Soft delete | JWT + rol `admin` |
| GET  | `/health` | Liveness probe | público |

## Modelo

```ts
Product {
  id: string;               // ObjectId
  sku: string;              // UNIQUE, uppercase, [A-Z0-9-]+ (estable, no editable)
  name: string;             // 3-120 chars
  description?: string;     // ≤ 500 chars
  price: number;            // > 0, ≤ 1.000.000, 2 decimals
  stock: number;            // entero ≥ 0
  category: 'cereales' | 'oleaginosas' | 'forrajeras' | 'otros';
  isActive: boolean;        // default true
  deletedAt: Date | null;   // soft delete (preserva trazabilidad SENASA)
  createdAt, updatedAt: Date;
}
```

## Estructura (Clean Architecture)

```
src/
├── domain/
│   ├── product.entity.ts
│   ├── product.repository.ts        # port (interface)
│   ├── token-verifier.ts            # port — solo verify, no firma
│   └── errors.ts (ProductNotFoundError, DuplicateSkuError)
├── application/
│   ├── dto/ (create, update, list query)
│   └── use-cases/ (5)
├── infrastructure/
│   ├── persistence/ (Mongoose schema + repo implementation)
│   └── security/ (JwtVerifier — comparte JWT_ACCESS_SECRET con auth-service)
├── interface/http/
│   ├── product.controller.ts
│   ├── health.controller.ts
│   └── dtos/product-response.dto.ts
└── common/
    ├── decorators/ (Public, Roles, CurrentUser)
    ├── guards/ (JwtAuthGuard global, RolesGuard a nivel controller)
    └── filters/all-exceptions.filter.ts
```

## Seguridad / autorización

- ✅ JWT verificación con `algorithms: ['HS256']` explícito (mitiga `alg=none`).
- ✅ `RolesGuard` + `@Roles('admin')` en **todas las mutaciones** (POST/PATCH/DELETE).
- ✅ `includeInactive=true` solo respetado si el JWT tiene `role === 'admin'`.
- ✅ Search input escapado para regex Mongo (evita ReDoS + inyección).
- ✅ `sanitizeFilter: true` global en Mongoose (bloquea inyección de operadores `$where`, `$gt`, etc).
- ✅ ValidationPipe estricto (`whitelist`, `forbidNonWhitelisted`).
- ✅ Soft-delete con `deletedAt` — `findById` excluye eliminados por default.
- ✅ Logging redacted (no se imprime authorization header ni passwords).

## Correr

```bash
# Con Mongo levantado en :27017 (instancia products)
pnpm --filter @peaku/products-service start:dev
```

- API: `http://localhost:3002/api/v1/products/...`
- Swagger: `http://localhost:3002/api/docs`

## Tests

```bash
pnpm --filter @peaku/products-service test
```

Cubre: `CreateProductUseCase` (happy + SKU duplicado + normalización), `ListProductsUseCase` (paginación + autorización de `includeInactive`).
