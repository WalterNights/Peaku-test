# Ejercicio 5 — Seguridad en APIs y Cloud

> **Consigna:** Responder brevemente preguntas relacionadas con OAuth vs JWT, protección contra fuerza bruta, seguridad en bases de datos MongoDB y despliegue de microservicios en la nube.

---

## 1. OAuth vs JWT — ¿cuándo cada uno?

**Confusión común**: se compara OAuth con JWT como si fueran lo mismo, pero **son dos cosas distintas que pueden coexistir**.

| Aspecto | OAuth 2.0 | JWT |
|---|---|---|
| Qué es | **Protocolo de autorización delegada** | **Formato de token autocontenido** (RFC 7519) |
| Para qué sirve | "Permito que la app X acceda a mis recursos en el servidor Y sin compartirle mi password" | Transportar claims firmados que cualquier servicio puede validar sin consultar a otra DB |
| Ejemplo de uso | "Login con Google" — la app delega la autenticación a Google y recibe un token de acceso | El access token que el server emite después del login (puede ser JWT o un opaco) |
| Estado | Stateless desde el cliente; el provider tiene state | Stateless por diseño (toda la info está en el token) |
| Revocación | Vía revoke endpoint del provider | Difícil (necesita lista negra o tokens cortos + refresh) |

### Cuándo elegir uno u otro

- **JWT solo** (lo que hicimos en esta prueba): app con auth propia, sin login con terceros, sin federación. Simple, sin dependencias externas, escalable horizontalmente sin shared session store.
- **OAuth 2.0** (NO implementado, en alcance del Ej. 5): cuando querés "Login con Google/Facebook/SSO corporativo" (los botones disabled del UI lo simulan). El **access token que devuelve OAuth típicamente ES un JWT**, así que ambos coexisten.
- **OAuth + JWT + OIDC** (OpenID Connect): el setup más completo. OAuth maneja la autorización, OIDC agrega identidad (claims del usuario), JWT es el formato del id_token y access_token.

### Implementación de este proyecto

**Elegimos JWT** porque:
- La prueba pide "protección de endpoints mediante JWT" explícitamente (Ej. 1).
- No hay requerimiento de federación con terceros.
- Mantiene el alcance acotado (sin dependencia con un Identity Provider externo).

**Hardening aplicado en `auth-service`**:
- Secret de 256+ bits cargado desde `.env` (no hardcoded), validado al boot con Joi.
- Issuer + Audience claims (`iss: peaku-auth`, `aud: peaku-api`) verificados en cada request.
- Access token TTL 15min (corto — limita la ventana de un token robado).
- **Refresh token con rotación**: cada `/refresh` emite un nuevo refresh y guarda el hash bcrypt en DB; el viejo queda invalidado. Si un atacante usa un refresh robado **después** de que el usuario lo usó legítimo, falla.
- Refresh token hash en DB permite **revocación explícita** en `/logout`.

```typescript
// apps/auth-service/src/application/use-cases/login-user.use-case.ts
const pair = await this.tokens.signPair({
  sub: user.id, email: user.email, role: user.role,
});
const refreshHash = await this.hasher.hash(pair.refreshToken);
await this.users.updateRefreshTokenHash(user.id, refreshHash);
```

---

## 2. Protección contra fuerza bruta

### Vectores de ataque

1. **Credential stuffing**: el atacante prueba pares email+password de leaks públicos (HaveIBeenPwned).
2. **Password spraying**: pocas passwords comunes (`Password123!`, `Welcome2024`) contra muchas cuentas.
3. **Brute-force individual**: muchos intentos contra una cuenta específica.

### Defensas aplicadas

#### 2.1 Rate limiting por IP (en gateway + auth-service)

Implementado con `@nestjs/throttler`:

```typescript
// apps/auth-service/src/interface/http/auth.controller.ts
@Post('login')
@Throttle({ default: { limit: 10, ttl: 60_000 } })  // 10 intentos/min por IP
async login(@Body() dto: LoginDto) { ... }

@Post('register')
@Throttle({ default: { limit: 5, ttl: 60_000 } })   // 5 registros/min por IP
async register(@Body() dto: RegisterDto) { ... }
```

Cuando se supera el límite, el endpoint devuelve **429 Too Many Requests**. El frontend lo parsea como "Demasiados intentos. Esperá un momento."

#### 2.2 Defensa contra timing attacks

El `LoginUserUseCase` hace `hasher.compare` **siempre**, incluso si el email no existe, con un hash dummy:

```typescript
const passwordOk = user
  ? await this.hasher.compare(dto.password, user.passwordHash)
  : await this.hasher.compare(dto.password, '$2b$12$invalidinvalidinvalidinvalidu...');
```

Sin esto, un atacante puede distinguir "email no existe" (respuesta rápida) vs "email existe, password incorrecta" (respuesta lenta porque bcrypt es lento). Con la defensa, **el tiempo es uniforme** y no se filtra qué emails están registrados.

#### 2.3 bcrypt cost ≥ 12

```typescript
// apps/auth-service/src/infrastructure/security/bcrypt.hasher.ts
hash(password: string): Promise<string> {
  return bcrypt.hash(password, 12);  // cost 12 = ~250ms en CPU moderno
}
```

Cost 12 ≈ 4096 rounds. Un atacante con una RTX 4090 que captura el dump de DB tarda **años** en crackear una password decente.

#### 2.4 Mejoras adicionales (no implementadas, fuera de alcance)

- **Account lockout** tras N intentos fallidos (con notificación por email).
- **CAPTCHA** después de 3 intentos fallidos.
- **2FA** obligatorio para roles admin.
- **Notificación de login desde dispositivo nuevo** (email + opción de revocar sesión).

---

## 3. Seguridad en MongoDB

### Vectores de ataque

1. **NoSQL injection** vía operadores en payloads JSON (`{"email": {"$ne": ""}, "password": {"$ne": ""}}` autentica con cualquier password si no se filtra).
2. **Acceso directo al port 27017** si está expuesto (los crawlers buscan Mongo abierto con `mongodb://localhost:27017?authSource=admin`).
3. **Backup leakage** de dumps `.bson` sin encriptar.

### Defensas aplicadas

#### 3.1 Validación estricta de DTOs

```typescript
// apps/auth-service/src/application/dto/login.dto.ts
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
```

Con `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` global:
- `whitelist: true` strip-ea propiedades no declaradas en el DTO.
- `forbidNonWhitelisted: true` rechaza el payload entero con 400 si tiene props extra.

Resultado: `{"email": {"$ne": ""}}` falla `IsEmail` y devuelve 400 antes de tocar Mongo.

#### 3.2 Mongoose con tipos fuertes

```typescript
// apps/auth-service/src/infrastructure/persistence/user.schema.ts
@Schema({ collection: 'users', timestamps: true, versionKey: false })
export class UserSchema {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;
  // ...
}
```

Mongoose siempre coerce a string. Inyectar `{$ne: ""}` falla la validación de tipo.

#### 3.3 Red privada Docker

En `docker-compose.yml`, los puertos de Mongo **no se exponen al host**:

```yaml
services:
  mongo-auth:
    image: mongo:7
    # ports: NO EXPONER en producción real
    networks: [internal]
  auth-service:
    networks: [internal, public]
```

Sólo `auth-service` (red interna) puede acceder a `mongo-auth`. El gateway no toca Mongo directo.

#### 3.4 Connection string con auth obligatorio

`.env.example`:
```bash
MONGO_AUTH_URI=mongodb://peaku_auth:STRONG_PASSWORD@mongo-auth:27017/peaku-auth?authSource=admin
```

Sin user+password no se conecta. En producción, el password viene de un secret manager (AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault), no del `.env`.

#### 3.5 Índice unique de email

```typescript
@Prop({ unique: true })
email!: string;
```

A nivel DB se evita race conditions de doble registro con el mismo email (que un check JS pre-insert no garantiza bajo concurrencia).

#### 3.6 Soft delete + auditoría

`products` tiene `deletedAt?: Date | null`. **No se borran filas físicamente** — se preservan para trazabilidad regulatoria (importante en agro: SENASA exige histórico de lotes).

#### 3.7 Defensas adicionales (no implementadas, fuera de alcance)

- **Encryption at rest** vía MongoDB Encrypted Storage Engine o filesystem encryption (LUKS).
- **TLS entre auth-service y Mongo** (`mongodb://...?tls=true&tlsCertificateKeyFile=...`).
- **Field-Level Encryption** para columnas sensibles (PII).
- **Network ACLs en el VPC** que sólo permitan tráfico desde subnets específicas.
- **Backup encriptado + restore drill mensual**.

---

## 4. Despliegue de microservicios en la nube

### Topología recomendada (no implementada, alcance teórico)

```
                ┌────────────────────────────────────┐
                │   CloudFront / CDN (assets SPA)    │
                └──────────────────┬─────────────────┘
                                   │
                                   ▼
                       ┌────────────────────┐
                       │   AWS WAF + ALB    │  ← TLS termination, rate-limit, OWASP rules
                       └─────────┬──────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                             ▼
            ┌───────────┐                 ┌──────────┐
            │ EKS Pod   │                 │ EKS Pod  │
            │ Gateway   │                 │ Gateway  │ ← HPA 2-N réplicas
            └─────┬─────┘                 └─────┬────┘
                  └──────────┬──────────────────┘
                             │ mTLS interna (Istio/Linkerd)
            ┌────────────────┼─────────────────┐
            ▼                ▼                 ▼
       ┌────────┐       ┌────────┐        ┌────────┐
       │ Auth   │       │ Prod   │        │ ...    │
       │ Pods   │       │ Pods   │        │        │
       └───┬────┘       └───┬────┘        └────────┘
           │                │
           ▼                ▼
       ┌────────┐       ┌────────┐
       │ Mongo  │       │ Mongo  │   ← MongoDB Atlas (managed), VPC peering
       │ Atlas  │       │ Atlas  │
       └────────┘       └────────┘
```

### Capas de seguridad

#### 4.1 Red

- **VPC** con subnets privadas para los pods + DB. Sólo el ALB está en subnet pública.
- **Security Groups / Network Policies** que sólo permitan:
  - ALB → Gateway pods (puerto 4050).
  - Gateway → Auth/Products pods (3001, 3002).
  - Auth/Products → MongoDB Atlas (puerto 27017, IP allowlist).
- **WAF** (Cloudflare / AWS WAF) con reglas OWASP Top 10, rate limiting global, bot mitigation.

#### 4.2 Identity

- **IAM Roles for Service Accounts (IRSA)** en EKS — cada pod tiene rol IAM mínimo necesario (principio de menor privilegio).
- **Secrets en AWS Secrets Manager** rotados automáticamente, no en variables de entorno hardcoded.
- **mTLS entre servicios internos** vía Istio o Linkerd — un servicio comprometido no puede impersonar a otro.

#### 4.3 Runtime

- **Container hardening**: imagenes Alpine/distroless (~50MB), non-root user (`USER node`), read-only filesystem.
- **Pod Security Standards** (PSS) `restricted`.
- **Resource limits** (CPU + memory) para evitar resource exhaustion de un servicio comprometido.
- **HPA** (Horizontal Pod Autoscaler) basado en CPU + custom metrics (RPS, latencia p95).

#### 4.4 CI/CD

- **GitHub Actions / GitLab CI** con jobs separados para build, test, security scan (Trivy, Snyk, npm audit), deploy.
- **Image signing** con Cosign (Sigstore) — el cluster sólo deploya imágenes firmadas con la key del CI.
- **GitOps con ArgoCD**: el desired state vive en git; cambios manuales en el cluster se revierten automáticamente.

#### 4.5 Observability

- **Logs centralizados** (Loki / Elastic / CloudWatch Logs) con retención + correlación por `correlationId` (ya emitido por el gateway en este proyecto).
- **Metrics** (Prometheus + Grafana) con alertas en SLOs (p99 latency, error rate, request rate).
- **Tracing distribuido** (Jaeger / Tempo) propagando el correlation-id entre servicios.

#### 4.6 Compliance + Auditoría

- **Auditoría inmutable** de cambios de precios y órdenes (importante en agro por compliance).
- **GDPR/PII handling**: el `email` y `firstName/lastName` son PII — DPA con MongoDB Atlas, derecho al olvido (soft delete con purge programado a los 30 días tras request).

### Lo que aplicamos en este proyecto (alcance prueba)

- ✅ Docker Compose para dev/test local (no Kubernetes).
- ✅ Multi-stage Dockerfiles con build cache, non-root user, image ~120MB.
- ✅ Healthchecks por servicio.
- ✅ Variables sensibles vía `.env` (no en código).
- ✅ Hardening pnpm a nivel supply-chain (`minimum-release-age=1440`, `allowBuilds` whitelist, `frozen-lockfile`) — más detalle en [`docs/04-seguridad.md`](../04-seguridad.md) §13.

Para producción real, el siguiente paso natural es subir esto a EKS o Cloud Run (sin lock-in) con Terraform y GitOps.

---

## 5. Conclusión

La seguridad es **defensa en profundidad** — múltiples capas, ninguna se confía como única.

| Capa | Defensa aplicada en este proyecto |
|---|---|
| Cliente | sessionStorage (no localStorage), CSP headers, sin secrets en JS |
| Network | Helmet, CORS estricto desde `.env`, rate-limit por IP |
| Auth | JWT corto + refresh con rotación, bcrypt cost 12, timing-attack defense |
| Validación | class-validator estricto, whitelist + forbidNonWhitelisted |
| Datos | Mongoose tipado, índices unique, soft delete, red interna Docker |
| Supply-chain | pnpm minimum-release-age 24h, allowBuilds whitelist, lockfile frozen |
| Observability | Correlation-id propagado, logs estructurados |

**Trade-off honesto**: para una prueba técnica no implementamos OAuth, 2FA, ni el stack completo cloud (EKS + Istio + Vault + ArgoCD). Eso sería sobre-ingeniería para el alcance pedido. Las defensas que SÍ aplicamos cubren el OWASP API Top 10 a nivel base, suficiente para no ser comprometido por scripts genéricos.
