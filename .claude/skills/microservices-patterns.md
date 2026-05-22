---
name: microservices-patterns
description: Use when designing, scaffolding, or reviewing microservice boundaries and inter-service communication in this project. Enforces database-per-service, gateway-only public ingress, correlation-id propagation, statelessness, graceful shutdown, and documented sync vs async trade-offs. Triggers — Spanish "microservicios", "comunicación entre servicios", "patrón saga", "event-driven" — English "microservice design", "service-to-service", "saga", "event sourcing", "API gateway pattern".
---

# Microservices Patterns (PeaKu-prueba)

You are designing or reviewing how the microservices in this project communicate, scale, and fail. Apply the rules below and reference `docs/01-arquitectura.md`.

## Service boundary rules

- **Database-per-service** — never share a Mongo instance between `auth-service` and `products-service`. Two separate Mongo containers in compose.
- **No shared models** — `libs/shared` may contain DTOs / TypeScript types, **never** Mongoose schemas or repository implementations.
- **One bounded context per service** — if you find yourself adding a "users" endpoint to `products-service`, stop: that's coupling.
- **Public ingress only through the gateway** — `auth-service:3001` and `products-service:3002` are NOT exposed to the host in production compose. Dev compose may expose them for debugging.

Red flags:
- 🔴 Two services querying the same Mongo collection.
- 🔴 A service importing from another service's source folder.
- 🔴 A controller in `auth-service` calling Mongoose models from `products-service`.

## Communication

### Sync (HTTP) — when to use

- The caller needs the data **right now** to respond to the user.
- Operation is read-only or critical for the request flow.
- Latency budget < 200ms.

### Async (events / messages) — when to use

- The caller doesn't need the result to respond.
- Multiple consumers care about the same event (`OrderPlaced` → inventory, payment, notification).
- The work is retriable / idempotent.

### For this project (scope decision)

- Gateway → services: HTTP (sync). Documented in `docs/01-arquitectura.md` §5.
- Service ↔ service: **none in scope**. If you find yourself wanting it, document why and either:
  1. Push the logic to the caller, or
  2. Open an explicit "we'd add RabbitMQ here in production" note in the doc.

## Mandatory cross-cutting concerns

Every service must implement:

### 1. Correlation-ID

- Gateway generates `x-correlation-id: <uuid>` per request if absent.
- Propagated as HTTP header to downstream services.
- Logged on every log line.
- Returned in error responses for support traceability.

### 2. Health checks

- `GET /health` → liveness (process is up).
- `GET /health/ready` → readiness (DB reachable, dependencies OK).
- No auth on health endpoints.
- Used by docker/k8s healthcheck and load balancer.

### 3. Graceful shutdown

- `app.enableShutdownHooks()` in NestJS.
- On `SIGTERM`: stop accepting new requests, drain in-flight, close Mongo connection, exit.
- Compose/k8s gives 30s before SIGKILL.

### 4. Stateless

- No in-process state that survives a restart (sessions, caches that matter).
- If you need state, push it to Mongo or Redis.
- Enables horizontal scaling and rolling deploys.

### 5. Idempotency for unsafe operations (when adding new endpoints)

- Mutations that can be retried (e.g., due to network) accept an `Idempotency-Key` header.
- Server stores `(key, response)` for N minutes and returns the cached response on retry.
- Out of scope for the initial CRUD but flag any *new* endpoint missing this if it does external side effects.

## API contracts

- Swagger / OpenAPI per service, mounted at `/api/docs`.
- Breaking changes bump version (`/api/v1`, `/api/v2`).
- Error envelope is consistent across all services:
  ```json
  {
    "statusCode": 400,
    "message": "Validation failed",
    "error": "Bad Request",
    "details": [{ "field": "email", "issue": "must be an email" }],
    "correlationId": "uuid",
    "timestamp": "ISO-8601"
  }
  ```

## When designing a new service

Ask in order:
1. **Why does this need to be a separate service?** (Different scaling, different team, different DB, different lifecycle.) If none → it's a module, not a service.
2. **What does it own?** Name the entities. Other services can't write to them.
3. **What does it call?** Synchronous deps → coupling. Limit and document them.
4. **What does it emit?** (Future, when broker is added.) List the events.
5. **How does it fail?** What happens if its DB is down? What does the gateway return?

## When reviewing existing service code

- Confirm the service has no inbound coupling that bypasses the gateway in production.
- Confirm DB credentials/URI are unique to this service.
- Confirm logs include `service`, `correlationId`, `level`, `msg`.
- Confirm shutdown hooks are wired.
- Confirm no in-memory state that breaks under multiple replicas.

## Trade-offs to document explicitly when relevant

| Pattern | Pro | Contra | When to choose |
|---------|-----|--------|----------------|
| Sync HTTP between services | Simple, easy to debug | Temporal coupling, cascading failures | Read-heavy, low-latency reads |
| Message broker (RabbitMQ/NATS) | Decoupled, retriable | Operational cost, eventual consistency | Multiple consumers, async work |
| Saga (orchestrated) | Centralized logic, easier to reason | Single point of failure | Complex flows, few participants |
| Saga (choreographed) | Fully decentralized | Hard to debug, no global view | Simple flows, many participants |
| CQRS + read model | Fast reads, scalable | Two models to maintain | Hot reads with complex queries |
| Event sourcing | Full audit, time travel | Steep curve, projection rebuild cost | Domains where history is the truth |

## Output format when reviewing a design

```
Microservices review — <feature/PR>

Service boundaries
  ✅ / ⚠️ / ❌  <observation>

Communication
  ✅ / ⚠️ / ❌  <observation>

Cross-cutting (correlation-id, health, shutdown, stateless)
  ✅ / ⚠️ / ❌  <observation>

Trade-offs called out
  <list>

Status: APPROVED / NEEDS CHANGES — <reason>
```
