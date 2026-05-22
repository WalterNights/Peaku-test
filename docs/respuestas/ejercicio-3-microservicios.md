# Ejercicio 3 — Arquitectura de Microservicios

> **Consigna:** Explicar cómo diseñarías una arquitectura de microservicios para una plataforma de e-commerce del sector agropecuario, incluyendo servicios, comunicación y seguridad. Se evaluará criterio técnico, contextualización y trade-offs.

---

## 1. Resumen ejecutivo

Para una plataforma de e-commerce del sector **agropecuario** propongo una arquitectura de microservicios con dos características que la diferencian de un e-commerce genérico:

1. **Modelo de dominio centrado en el lote, no en el producto unitario**. Granos, ganado y agroquímicos se comercian por lote con trazabilidad (SENASA, certificaciones orgánicas, fecha de cosecha, origen geográfico). El "producto" no es una unidad fungible — es un instance con historia.
2. **Precios atados a commodities y estacionalidad**. La soja cotiza diario en CBOT/MATBA; el catálogo no puede ser estático.

La arquitectura aplica **database-per-service**, **API Gateway como único ingress público**, **JWT con rotación de refresh tokens** y **comunicación mixta** (sync HTTP en el camino crítico del usuario, async vía broker para eventos de dominio).

Como prueba de concepto implementé **3 de los servicios fundamentales** (auth, products, api-gateway) siguiendo el patrón completo, dejando documentado cómo escala al diseño extendido.

---

## 2. Base implementada (prueba de concepto)

Los 3 servicios construidos demuestran el patrón end-to-end:

```
                              ┌──────────────────────────┐
   Cliente (Angular SPA) ───► │     API Gateway :4050    │
                              │  · valida JWT            │
                              │  · rate limit            │
                              │  · CORS + Helmet         │
                              │  · correlation-id        │
                              └────┬─────────────────┬───┘
                                   │ HTTP interno    │
                              ┌────▼────────┐  ┌─────▼─────────┐
                              │ auth-svc    │  │ products-svc  │
                              │ :3001       │  │ :3002         │
                              │ · register  │  │ · CRUD prod.  │
                              │ · login     │  │ · paginación  │
                              │ · refresh   │  │ · soft delete │
                              │ · FIRMA JWT │  │ · VERIFICA JWT│
                              └────┬────────┘  └──────┬────────┘
                                   │                  │
                              ┌────▼─────┐       ┌────▼─────┐
                              │ mongo    │       │ mongo    │
                              │ auth     │       │ products │
                              └──────────┘       └──────────┘
```

### Decisiones técnicas aplicadas (medibles en el código)

| Principio | Implementación verificable |
|-----------|---------------------------|
| **Database per service** | Dos instancias MongoDB independientes (`mongo-auth`, `mongo-products`) en el `docker-compose.yml`. Sin colecciones compartidas. |
| **Clean Architecture por servicio** | 4 capas (`domain → application → infrastructure → interface`) con regla de dependencia hacia el dominio. Cada servicio testea sus use cases sin contenedor NestJS. |
| **SOLID** | Use cases reciben **interfaces** (`UserRepository`, `PasswordHasher`, `TokenService`/`TokenVerifier`) vía DI con tokens (`Symbol`); cambiar Mongo por Postgres solo modifica `infrastructure/`. |
| **Single Responsibility a nivel servicio** | `auth-service` puede **firmar y verificar** JWTs; `products-service` solo puede **verificar**. Implementado con dos puertos distintos (`TokenService` vs `TokenVerifier`). Aunque el secret se comparta, products no puede emitir tokens. |
| **Gateway como ingress único** | En producción los puertos `:3001` y `:3002` no se exponen al host — solo `:4050`. |
| **Statelessness** | Sin sesiones en memoria; el estado vive en Mongo o en el JWT del cliente. Cualquier servicio puede escalar horizontalmente. |
| **Stateless + correlation-id** | Cada request del gateway recibe un `x-correlation-id` (UUID) que se propaga a los servicios downstream y aparece en cada log. Trazabilidad end-to-end sin distributed tracing instalado. |
| **Health checks** | `GET /health` en cada servicio para liveness probes de Docker/k8s. |
| **Graceful shutdown** | `app.enableShutdownHooks()` — los servicios drenan requests en vuelo ante SIGTERM. |

### Hardening de seguridad real (no aspiracional)

- **JWT HS256** con `algorithms: ['HS256']` **explícito** en verificación (mitiga el ataque histórico `alg=none`).
- **Refresh tokens rotativos** con hash en DB. Reutilizar un refresh viejo revoca toda la familia (detección de robo).
- **Constant-time dummy `bcrypt.compare`** cuando el email no existe — mitiga timing attacks que revelarían si un email está registrado.
- **bcrypt cost 12**.
- **Rate limiting estricto** por endpoint: 5/min `/register`, 10/min `/login`, 20/min `/refresh`.
- **`mongoose.set('sanitizeFilter', true)`** global — envuelve user input en `$eq`, bloquea inyección de operadores Mongo. Reemplaza al deprecated `express-mongo-sanitize` (sin mantener desde 2022, roto en Express 5).
- **ValidationPipe estricto** (`whitelist: true`, `forbidNonWhitelisted: true`) en cada servicio.
- **`passwordHash` y `refreshTokenHash` excluidos** de toda respuesta JSON (transform en schema Mongoose).
- **Helmet + CORS por whitelist** desde `.env`.
- **Supply chain hardening** (pnpm 11): `minimumReleaseAge: 1440` (cooldown 24h), `allowBuilds` whitelist, `overrides` forzando versiones seguras de transitivas con CVE. **0 vulnerabilidades** en `pnpm audit --prod`.

---

## 3. Cómo escala al e-commerce agropecuario completo

Esta es la arquitectura objetivo, con la **prueba de concepto extendida** a un sistema productivo. Los servicios en negrita son los implementados.

| Servicio | Responsabilidad | Específico al sector |
|----------|-----------------|---------------------|
| **api-gateway** | Routing, JWT, rate limit, CORS | ✅ implementado |
| **identity-service** | Usuarios, **roles diferenciados**, perfiles | Roles distintos: productor, comprador, transportista, certificador. **Permisos heterogéneos**: un productor publica lotes, un comprador hace órdenes a futuro, un certificador firma calidad. |
| **catalog-service** (≈products) | Productos, categorías, atributos | ✅ implementado (versión simple). Real: atributos como temporada de cosecha, **unidad de medida** (kg/ton/hectárea/cabeza), certificaciones (orgánico, kosher, fitosanitario SENASA), origen geográfico (provincia/localidad). |
| **inventory-service** | Stock por **lote** | Stock no es un número — es una colección de lotes con fecha de cosecha, vencimiento, ubicación física (silo bolsa, planta de acopio). Cosecha estacional implica **ventanas de disponibilidad**. |
| **pricing-service** | Precios dinámicos | Atado a cotización CBOT/MATBA (soja, maíz, trigo). Recibe ticks vía broker y publica `PriceUpdated`. Permite ventas a futuro con precio fijado al momento del contrato. |
| **order-service** | Órdenes, contratos, estados | Soporta dos modelos: **spot** (entrega inmediata) y **forward** (entrega futura con precio bloqueado, propio del agro). |
| **payment-service** | Pasarela | Integración MercadoPago/Stripe + **financieras agropecuarias** que aceptan canje por cosecha (lazos con bancos como Galicia Agro, ICBC Rural). |
| **logistics-service** | Envíos, tracking, fletes | Logística a granel (camiones cerealeros) o refrigerada (frigoríficos). Integración con transportistas y operadores logísticos del NOA/Pampa Húmeda. |
| **certifications-service** | Trazabilidad SENASA/IRAM/USDA | **Específico del rubro y crítico**: cada lote tiene certificados emitidos por organismo; sin ellos no se puede comercializar. Auditoría inmutable. |
| **notification-service** | Email, SMS, push | Alertas críticas: cambios de precio del commodity, condiciones climáticas que afectan cosecha, vencimiento de certificados. |
| **search-service** | OpenSearch / Elasticsearch | Búsqueda geográfica (radio desde origen), por temporada, por certificación. **CQRS**: mantiene una vista materializada de catálogo + pricing + inventory. |

---

## 4. Comunicación entre servicios

La regla aplicada: **sync HTTP cuando el caller necesita el resultado para responder al usuario; async events cuando puede continuar sin esperar.**

### Sync (HTTP, vía gateway o directo)
- Frontend → Gateway: REST + JWT en `Authorization: Bearer`.
- Gateway → servicios internos: HTTP en red Docker privada, con `x-correlation-id` propagado.
- En la prueba: usamos esto entre los 3 servicios.

### Async (message broker — **RabbitMQ** o **NATS** en producción)
Aplicado a **eventos de dominio**:

| Evento | Publicador | Consumidores | Por qué async |
|--------|-----------|--------------|---------------|
| `OrderPlaced` | order-service | inventory (reserva lote), payment (cobra), notification (avisa al productor), logistics (programa envío) | El comprador no debe esperar a que se ejecuten 4 procesos para ver "orden confirmada" |
| `PriceUpdated` | pricing-service (escucha ticks de commodity) | catalog (actualiza precio mostrado), search (re-indexa), notification (alerta si superó umbral) | Cientos de ticks por minuto durante horario bursátil — no se puede acoplar el catálogo a ese ritmo |
| `CertificateExpired` | certifications-service | catalog (oculta lote), notification (avisa al productor) | El catálogo no debe consultar certificaciones en cada request |
| `StockDepleted` | inventory-service | notification (al productor), catalog (marca out-of-stock) | Eventual consistency aceptable |

### Patrón **outbox** para consistencia
Cuando un servicio modifica su DB Y debe publicar un evento, lo hace en **una sola transacción**: persiste el cambio + escribe un registro en `outbox` collection. Un worker aparte publica al broker y marca como enviado. Garantiza "at-least-once delivery" sin distributed transactions.

### Patrón **saga** para flujos transaccionales distribuidos
Ejemplo: crear una orden requiere reservar lote (inventory) → cobrar (payment) → programar envío (logistics). Si payment falla, hay que **compensar** la reserva. Implementación recomendada: **orquestada** (un order-saga coordinator centraliza el flujo) — más simple de razonar y debuggear que la choreografía para este caso.

---

## 5. Seguridad transversal

### Autenticación y autorización
- **OAuth 2.0 + OIDC** vía Keycloak/Auth0 para SSO en producción. Permite login con Google/Facebook y acceso a APIs de terceros (proveedores logísticos).
- **PKCE obligatorio** para SPAs y mobile (sin PKCE, un SPA público no puede tener client secret).
- **JWT cortos** (5-15 min) + refresh con rotación. **Lo implementé en auth-service**.
- **2FA con WebAuthn / hardware key** para usuarios admin (no SMS, no TOTP — phishing-resistant). El compromiso de cuentas npm en sep 2025 (chalk/debug) ocurrió por phishing del flujo de reset 2FA.

### Red
- **mTLS entre servicios internos** vía service mesh (Istio o Linkerd) — cada pod presenta certificado firmado por la CA del cluster. Defensa contra movimiento lateral si un servicio se compromete.
- **WAF** (Cloudflare/AWS WAF) delante del gateway — bot mitigation, geo-blocking, rate limiting a nivel L7. Especialmente importante en commodities donde los bots compradores son un problema real.
- **Network policies** en Kubernetes — productos no puede hablar con auth ni viceversa, solo a través del gateway o via broker.

### Datos
- **Secrets en Vault** (HashiCorp) o AWS Secrets Manager. **Nunca** en `.env` versionado.
- **Rotación periódica** de JWT signing secrets con grace period.
- **Encriptación at-rest** en Mongo (WiredTiger encryption) y backups cifrados.
- **Mongo bind a red privada** + autenticación con principio de menor privilegio (cada servicio tiene un user con `readWrite` solo en su DB, nunca `root`).

### Aplicación
- **OWASP API Top 10** revisado item por item (ver `docs/04-seguridad.md` §12).
- **Auditoría inmutable** (append-only log) para cambios de precio, órdenes, certificaciones. Compliance + investigación de fraude.

### Supply chain (lo que aprendimos en este proyecto)
El ecosistema npm sufrió múltiples ataques entre 2024-2026: Nx s1ngularity (ago 2025), chalk/debug (sep 2025), Shai-Hulud 1.0/2.0, axios norcoreano (mar 2026). Las defensas que **sí** aplicamos:

- **Cooldown** de 24h en pnpm para no instalar paquetes recién publicados.
- **Whitelist explícita** de paquetes que pueden ejecutar postinstall scripts (bloquea ataques tipo Nx).
- **Overrides** forzando versiones seguras de transitivas con CVE conocidas.
- **`pnpm audit` como gate de CI** que falla el build en high/critical.
- **GitHub Actions pinneadas por SHA** (no por tag) — defensa contra el CVE-2025-30066 de `tj-actions/changed-files`.

---

## 6. Datos

**Polyglot persistence** — cada servicio elige la DB que mejor se ajusta a su modelo:

| Servicio | Engine | Justificación |
|----------|--------|---------------|
| auth, products, catalog | **MongoDB** | Schema flexible, productos heterogéneos (atributos distintos por categoría). Implementado. |
| order, payment | **PostgreSQL** | Transaccional ACID, necesidad de consistencia fuerte (no podemos cobrar dos veces). |
| inventory | **PostgreSQL** con extensión temporal | Lotes son entidades temporales con histórico de movimientos. |
| pricing | **Redis** (caché de cotización actual) + **TimescaleDB** (histórico) | Lecturas de precio actual ultra-rápidas; series temporales para análisis. |
| search | **OpenSearch** | Búsqueda geográfica y full-text, índices por temporada/certificación. |
| sessions / carrito | **Redis** | TTL nativo, lecturas hot. |

---

## 7. Despliegue (visión productiva)

- **Kubernetes** (EKS / GKE / AKS) en multi-AZ.
- **HPA** basado en CPU + custom metrics (RPS por servicio).
- **Imágenes con base mínima** (`node:22-alpine` o **distroless**), **escaneadas con Trivy** en CI, **firmadas con Cosign** y verificadas en admisión (Kyverno/OPA).
- **Containers como non-root** (en mis Dockerfiles ya: `USER node-app`).
- **Observability stack**: Prometheus + Grafana para métricas, Loki para logs, OpenTelemetry → Jaeger para tracing. El `correlation-id` que ya propago se convierte en trace-id.
- **CI/CD** con `pnpm audit --prod --audit-level=high` como gate de seguridad.
- **CDN** delante del gateway para assets estáticos del SPA.

---

## 8. Trade-offs explícitos

Una arquitectura de microservicios no es gratis. Lo declaro abiertamente:

| Trade-off | Decisión tomada | Costo asumido |
|-----------|----------------|---------------|
| **3 microservicios para una "API básica" de prueba** | Sobre-ingeniería intencional para demostrar el patrón en código real, no en slides | Más complejidad para levantar el entorno (mitigado con `docker compose up`) |
| **HTTP síncrono entre gateway y servicios** | Más simple que message broker para esta prueba | Acoplamiento temporal: si products-service cae, productos no responden. En producción se sumaría circuit breaker (Resilience4j) |
| **Sin message broker en la prueba** | RabbitMQ/NATS agregan operational overhead para 3 servicios | Documentado en este mismo PDF cómo se sumaría: eventos `OrderPlaced`, `PriceUpdated`, outbox pattern, saga |
| **Clean Architecture por capas (boilerplate)** | Testeable, intercambiable (cambiar Mongo por Postgres es 1 archivo) | Más archivos por feature; curva de aprendizaje inicial |
| **Database per service** | Aislamiento real, escalabilidad independiente | Más recursos en dev (2 Mongos vs 1); joins entre dominios requiere agregación a nivel aplicación o read-model dedicado |
| **JWT compartido vs identity provider centralizado** | Para 2 servicios + gateway, JWT compartido es suficiente | En producción real: Keycloak con introspection endpoint o JWKS rotativo |
| **Duplicación deliberada de `correlation-id.interceptor.ts`, `health.controller.ts`, etc. entre servicios** | Microservicios prefieren duplicar antes que acoplar via shared library de runtime code | Mantenimiento ligeramente mayor; mitigado porque ese código rara vez cambia. Lo que **sí** está en `libs/shared` son sólo **tipos y constantes** (contratos puros) |

### Cuándo NO usaría microservicios

Es importante decirlo: para un MVP con un equipo de 2 personas, un monolito modular bien estructurado (Clean Architecture en una sola app) es **superior**. Microservicios paga sentido cuando hay:
1. Equipos múltiples que necesitan deployar independientemente.
2. Componentes con perfiles de escalabilidad muy distintos (auth maneja picos de login, pricing maneja ticks de commodities — escalan distinto).
3. Compliance que requiere aislamiento (datos sensibles de pagos separados de catálogo público).

Para el ejercicio asumí que el e-commerce agropecuario alcanza ese tamaño en producción (multi-equipo, multi-región).

---

## 9. Conclusión

La arquitectura propuesta y **parcialmente implementada** combina:

- ✅ **Patrones probados** (Clean Architecture, database-per-service, API Gateway, JWT con rotación).
- ✅ **Específicos del sector** (lotes con trazabilidad, precios atados a commodity, certificaciones SENASA, ventanas estacionales).
- ✅ **Seguridad por defecto** (OWASP API Top 10, supply-chain hardening, JWT con algorithm pinning, rate limiting, mTLS interno previsto).
- ✅ **Pragmática** (3 servicios reales corriendo; lo que excede el alcance está documentado pero no implementado para evitar sobre-ingeniería).
- ✅ **Trade-offs explícitos** (cuándo HTTP sync vs eventos, cuándo monolito vs microservicios).

La prueba de concepto (3 servicios + 0 CVEs + 12 tests unitarios verdes + supply chain hardening + Docker compose listo) demuestra que el patrón es ejecutable end-to-end. Escalarlo a la plataforma completa es agregar servicios al mismo molde, no rehacer la base.
