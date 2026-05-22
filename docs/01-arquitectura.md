# 01 — Arquitectura

> Arquitectura de microservicios pragmática para la prueba técnica. Cubre el Ej. 1 (backend) y responde al Ej. 3 (diseño de microservicios para e-commerce agropecuario).

---

## 1. Visión general

```
                         ┌──────────────────────────┐
                         │   Frontend (Angular SPA) │
                         │   Nginx :4200            │
                         └────────────┬─────────────┘
                                      │ HTTPS (JWT en Authorization header)
                                      ▼
                         ┌──────────────────────────┐
                         │     API Gateway          │
                         │   NestJS  :4050          │
                         │  · Valida JWT            │
                         │  · Rate limiting         │
                         │  · CORS / Helmet         │
                         │  · Reverse proxy interno │
                         └──┬──────────────────┬────┘
                            │                  │  HTTP interno (red Docker)
              ┌─────────────▼──┐         ┌─────▼──────────┐
              │  Auth Service  │         │ Products Svc   │
              │  NestJS :3001  │         │ NestJS :3002   │
              │  · Login       │         │ · CRUD prod.   │
              │  · Register    │         │ · Validations  │
              │  · Refresh     │         │ · Swagger      │
              │  · Emite JWT   │         │                │
              └────────┬───────┘         └────────┬───────┘
                       │                          │
                  ┌────▼─────┐               ┌────▼─────┐
                  │ MongoDB  │               │ MongoDB  │
                  │ auth-db  │               │ products │
                  └──────────┘               └──────────┘
```

### Por qué este diseño

- **Database per service**: cada microservicio es dueño absoluto de sus datos (no se comparten colecciones).
- **Gateway como único punto de entrada**: simplifica CORS, autenticación y observabilidad. El frontend no necesita conocer la topología interna.
- **Red interna privada**: los servicios internos no son alcanzables desde fuera del compose network.
- **Stateless services**: cualquier servicio puede escalar horizontalmente; el estado vive en MongoDB y en el JWT del cliente.

## 2. Servicios

### 2.1 API Gateway (`apps/api-gateway`)

**Responsabilidades:**
- Único endpoint público.
- Verificación de JWT (signature + expiración) vía `JwtAuthGuard` global.
- Forwarding a servicios internos vía `HttpModule` (`@nestjs/axios`) o `http-proxy-middleware`.
- Rate limiting (`@nestjs/throttler`).
- Headers de seguridad (Helmet).
- CORS configurado por whitelist desde `.env`.
- Logging centralizado de requests (correlation-id propagado a downstream).

**Lo que NO hace:**
- Lógica de dominio.
- Acceso directo a base de datos.
- Reglas de autorización a nivel de recurso (eso vive en cada servicio).

### 2.2 Auth Service (`apps/auth-service`)

**Responsabilidades:**
- Registro de usuarios (con hash bcrypt, cost ≥ 12).
- Login → emite **access token** (15 min) + **refresh token** (7 días).
- Refresh endpoint → rota access token validando refresh.
- (Opcional) Endpoint `GET /me` para introspección.

**Modelo de datos** (colección `users`):

```ts
{
  _id: ObjectId,
  email: string,        // unique index
  passwordHash: string, // bcrypt
  role: 'admin' | 'user',
  refreshTokenHash?: string, // permite revocación
  createdAt: Date,
  updatedAt: Date,
}
```

### 2.3 Products Service (`apps/products-service`)

**Responsabilidades:**
- CRUD completo: `POST /products`, `GET /products` (paginado), `GET /products/:id`, `PATCH /products/:id`, `DELETE /products/:id`.
- Validaciones (class-validator) sobre DTOs.
- Swagger en `/api/docs`.
- Soft delete (campo `deletedAt`) para preservar trazabilidad.

**Modelo de datos** (colección `products`):

```ts
{
  _id: ObjectId,
  sku: string,             // unique index
  name: string,
  description?: string,
  price: number,           // > 0
  stock: number,           // ≥ 0
  category: string,
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date,
  deletedAt?: Date | null, // soft delete
}
```

## 3. Capas internas (Clean Architecture)

Cada microservicio sigue la misma estructura por capas:

```
apps/<service>/
├── src/
│   ├── domain/              # Entidades puras, sin dependencias externas
│   │   ├── product.entity.ts
│   │   └── product.repository.ts  # interface (port)
│   ├── application/         # Casos de uso (orquestación)
│   │   ├── dto/
│   │   │   ├── create-product.dto.ts
│   │   │   └── update-product.dto.ts
│   │   └── use-cases/
│   │       ├── create-product.use-case.ts
│   │       └── list-products.use-case.ts
│   ├── infrastructure/      # Adapters (DB, HTTP, etc.)
│   │   ├── persistence/
│   │   │   ├── product.schema.ts
│   │   │   └── mongo-product.repository.ts  # implements port
│   │   └── config/
│   ├── interface/           # HTTP layer (controllers)
│   │   └── http/
│   │       ├── product.controller.ts
│   │       └── dto-mappers/
│   ├── app.module.ts
│   └── main.ts
└── test/
```

**Regla de dependencia (clean architecture):**
- `domain` no depende de nadie.
- `application` depende de `domain`.
- `infrastructure` depende de `application` y `domain`.
- `interface` orquesta — depende de `application`.

Esto permite cambiar Mongo por Postgres tocando solo `infrastructure/`.

## 4. Aplicación de principios SOLID

| Principio | Aplicación concreta |
|-----------|--------------------|
| **S — Single Responsibility** | Cada controller, service y repository tiene una responsabilidad clara. Use cases atómicos (un caso de uso por archivo). |
| **O — Open/Closed** | Repositorios definidos como interfaces (puertos). Agregar Postgres = nueva implementación, no modificación. |
| **L — Liskov Substitution** | `MongoProductRepository` cumple el contrato de `ProductRepository` sin sorpresas (mismas excepciones, mismos retornos). |
| **I — Interface Segregation** | Interfaces específicas (`ProductReader`, `ProductWriter`) en lugar de un mega-repo, si el caso lo amerita. |
| **D — Dependency Inversion** | Use cases reciben interfaces vía DI (`@Inject(PRODUCT_REPOSITORY_TOKEN)`). Nunca dependen de Mongoose directamente. |

## 5. Comunicación entre servicios

### 5.1 Decisión: HTTP síncrono vía Gateway

- **Frontend → Gateway**: HTTPS + JWT.
- **Gateway → Servicios internos**: HTTP interno con header `x-internal-token` (shared secret en red privada Docker).
- **Servicios entre sí (futuro)**: para esta prueba **no hay** comunicación servicio-a-servicio.

### 5.2 Por qué no message broker

Para 3 servicios y un flujo CRUD, RabbitMQ/Kafka es overkill. Documentamos cómo escalaría:

> **Próximo paso (no implementado):** introducir RabbitMQ/NATS para eventos de dominio (`ProductCreated`, `OrderPlaced`). Cada servicio publica eventos; otros consumen sin acoplarse. Patrón **outbox** para garantizar consistencia con la DB.

### 5.3 Correlation-ID

El gateway genera un `x-correlation-id` por request y lo propaga a downstream. Cada log incluye este ID → trazabilidad end-to-end sin distributed tracing instalado.

## 6. Seguridad transversal

Detalle en [`04-seguridad.md`](./04-seguridad.md). Resumen:

- JWT firmado con secret de ≥ 256 bits, cargado desde `.env`.
- Refresh tokens con hash en DB (revocables).
- Helmet + CORS estricto.
- Rate limiting (60 req/min por IP en gateway, 10/min en `/auth/login`).
- Validación estricta de DTOs (`whitelist: true`, `forbidNonWhitelisted: true`).
- Sanitización de queries Mongo (`mongo-sanitize` o `express-mongo-sanitize`) contra NoSQL injection.
- Logs sin información sensible (passwords, tokens).

## 7. Diseño extendido para e-commerce agropecuario (respuesta Ej. 3)

> Cómo escalaría esta arquitectura a un e-commerce agropecuario real.

### 7.1 Servicios propuestos

| Servicio | Responsabilidad | Notas específicas al sector agropecuario |
|----------|-----------------|------------------------------------------|
| **api-gateway** | Auth, routing, rate limit | — |
| **identity-service** | Usuarios, roles, perfiles (productor, comprador, transportista) | Roles diferenciados son críticos: un productor vende, un comprador compra, un transportista logística. |
| **catalog-service** | Productos, categorías, atributos | Atributos especiales: temporada, origen geográfico, certificaciones (orgánico, kosher, fitosanitario), unidad de medida (kg, ton, hectárea). |
| **inventory-service** | Stock en tiempo real | Stock puede ser por **lote** (trazabilidad sanitaria). Cosecha estacional → ventanas de disponibilidad. |
| **order-service** | Carrito, órdenes, estados | Órdenes pueden ser por **contrato a futuro** (forward) — modelo distinto al e-commerce típico. |
| **payment-service** | Pasarela de pago (MercadoPago, Stripe) | Integración con financieras agropecuarias (canje por cosecha). |
| **logistics-service** | Envíos, tracking, fletes | Logística refrigerada o a granel. Integración con transportistas. |
| **notification-service** | Email, SMS, push | Alertas de cambios de precio (commodities), clima. |
| **pricing-service** | Precios dinámicos | Precio atado a cotización de commodities (soja, maíz). |
| **certifications-service** | Trazabilidad SENASA/IRAM | Específico del rubro: cada lote tiene certificado emitido por organismo. |
| **search-service** | Elasticsearch / OpenSearch | Búsqueda por geolocalización, categoría, temporada. |

### 7.2 Comunicación

- **Síncrona (HTTP/gRPC)**: lecturas críticas en el camino del usuario (ver detalle producto, login).
- **Asíncrona (message broker — RabbitMQ o NATS)**: eventos de dominio.
  - `OrderPlaced` → consumido por inventory, payment, notification.
  - `PriceUpdated` → consumido por catalog, notification (alertas).
  - `StockDepleted` → notification al productor.
- **CQRS** donde haya hot reads: `search-service` mantiene una vista materializada del catálogo.

### 7.3 Seguridad

- **OAuth 2.0 + OIDC** para SSO (Keycloak / Auth0).
- **JWT cortos** (5-15 min) + refresh tokens con rotación.
- **mTLS entre servicios internos** o service mesh (Istio/Linkerd).
- **Vault** para secrets.
- **WAF** (Cloudflare / AWS WAF) delante del gateway.
- **Rate limiting por usuario, no solo por IP** (los bots compradores son un problema real en commodities).
- **Auditoría inmutable** de cambios de precios y órdenes (compliance).

### 7.4 Datos

- Cada servicio con su DB (poliglota): Mongo para catálogo, Postgres para órdenes (transaccional ACID), Redis para carrito, Elasticsearch para búsqueda.
- **Saga pattern** para transacciones distribuidas (orden → reserva stock → pago → confirmar).
- **Event sourcing** opcional para `order-service` (auditoría natural).

### 7.5 Despliegue

- Kubernetes (EKS / GKE).
- HPA (autoscaling) basado en CPU + custom metrics (RPS).
- Multi-AZ.
- Observability: Prometheus + Grafana + Loki + Jaeger.

## 8. Trade-offs explícitos

| Decisión | Pro | Contra |
|----------|-----|--------|
| Microservicios en una prueba "básica" | Demuestra Ej. 3 en código real | Más complejo de levantar; revisor debe correr docker-compose |
| HTTP síncrono entre servicios | Simple, fácil de debuggear | Acoplamiento temporal; no resiliente a caídas |
| Mongo separados (no un solo cluster) | Aislamiento real | Más recursos en dev (mitigado con compose) |
| Clean architecture por capas | Testeable, intercambiable | Más archivos por feature (boilerplate) |
| Sin message broker | Menos infraestructura | No demuestra patrón event-driven (compensado en doc Ej. 3) |
