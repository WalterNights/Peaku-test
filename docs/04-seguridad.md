# 04 — Seguridad

> Plan de seguridad transversal del proyecto + base para la respuesta del Ejercicio 5 del PDF.

---

## 1. Modelo de amenazas (resumen STRIDE)

| Amenaza | Vector | Mitigación implementada |
|---------|--------|------------------------|
| **Spoofing** (suplantación) | Token robado | JWT corto (15 min) + refresh token rotativo + posibilidad de revocación. |
| **Tampering** (manipulación) | Modificar requests | Firma JWT con HMAC SHA-256, validación de DTOs estricta. |
| **Repudiation** | Negar acciones | Logging con correlation-id + `userId` en cada mutación. |
| **Information disclosure** | Dumps, errores verbosos | `class-transformer` `@Exclude()` en passwordHash, errores sin stack en prod. |
| **DoS** | Brute force, scraping | Rate limiting por IP + por endpoint sensible. |
| **Elevation of privilege** | User → admin | `RolesGuard` + `@Roles('admin')` en mutaciones. |

## 2. Autenticación: JWT (implementación)

### 2.1 Tokens

| Token | TTL | Storage cliente | Storage servidor | Revocable |
|-------|-----|-----------------|------------------|-----------|
| Access | 15 min | memoria + sessionStorage | no | no (por TTL corto) |
| Refresh | 7 días | sessionStorage | hash en DB | **sí** (borrar hash) |

**Decisión de storage en cliente:**
- Para esta prueba: `sessionStorage` (limpio al cerrar tab).
- Producción: cookie `HttpOnly; Secure; SameSite=Strict` (inmune a XSS).

### 2.2 Firma

- Algoritmo: **HS256** (HMAC SHA-256). Suficiente para servicios que comparten secret.
- Producción real: **RS256** (asimétrico) si el verifier no debe poder firmar.
- Secret cargado desde `.env`; nunca hardcodeado. Variable: `JWT_ACCESS_SECRET` (≥ 256 bits aleatorios).
- Validación: `iat`, `exp`, `iss`, `aud`.

### 2.3 Refresh con rotación

1. Cliente envía `refreshToken` a `POST /auth/refresh`.
2. Backend valida firma + hash en DB.
3. Si OK: emite **nuevo** access + **nuevo** refresh, invalida el anterior (rota hash).
4. Si el mismo refresh se usa dos veces → posible robo → revoca toda la familia.

## 3. OAuth 2.0 vs JWT (respuesta Ej. 5)

| Aspecto | OAuth 2.0 | JWT |
|---------|-----------|-----|
| **Qué es** | Protocolo de autorización delegada | Formato de token (autocontenido, firmado) |
| **Comparación** | No son rivales — JWT suele usarse como el token de OAuth | — |
| **Cuándo usar OAuth** | Login con Google/Facebook, delegación de acceso a APIs de terceros | — |
| **Cuándo usar JWT solo** | Auth interna en un sistema propio sin terceros | — |
| **Riesgo JWT** | Una vez emitido, difícil de revocar antes del exp | — |
| **Riesgo OAuth** | Implementación incorrecta del flujo (PKCE obligatorio en SPAs) | — |

**Recomendación**: OAuth 2.0 con OIDC + JWT como access token. PKCE para SPAs/mobile. Refresh tokens con rotación.

## 4. Protección contra fuerza bruta

| Capa | Mecanismo |
|------|-----------|
| **App** | `@nestjs/throttler` en `/auth/login`: 10 intentos/min/IP. |
| **App** | Backoff exponencial por usuario: tras 5 fallos, lock 15 min. |
| **App** | Mensaje genérico ("credenciales inválidas") — no revelar si el email existe. |
| **App** | CAPTCHA (reCAPTCHA / Turnstile) tras 3 fallos. *No implementado en la prueba; documentado.* |
| **Red** | WAF (Cloudflare/AWS WAF) con reglas de bot mitigation. |
| **Producto** | 2FA opcional (TOTP) para usuarios admin. |
| **Monitoring** | Alertas en SIEM ante picos de 401 desde una IP. |

## 5. Seguridad en MongoDB

### 5.1 Configuración del servidor

- `--auth` habilitado siempre (en compose: `MONGO_INITDB_ROOT_USERNAME/PASSWORD`).
- TLS para conexiones (`?tls=true&tlsCAFile=...`).
- Usuarios con principio de **menor privilegio**: `readWrite` en su DB, nunca `root`.
- Bind a `127.0.0.1` o red interna; nunca expuesto a internet.
- Logs de auditoría habilitados.
- Backup cifrado + recovery testeado (real prod).

### 5.2 A nivel aplicación

- **NoSQL injection** — defensa en capas (¡NO usar `express-mongo-sanitize`, está abandonado desde 2022 y roto en Express 5!):
  1. **`ValidationPipe` estricto** con `whitelist: true` + `forbidNonWhitelisted: true` en cada servicio. Si el DTO no declara un campo `$where`, nunca llega al repositorio.
  2. **`mongoose.set('sanitizeFilter', true)`** globalmente en cada servicio que usa Mongoose. Envuelve valores user-provided en `$eq` automáticamente, bloqueando inyección de operadores.
  3. **Schemas Mongoose estrictos** (`strict: 'throw'` o el default `strict: true`): rechazan campos no declarados antes de llegar a la DB.
- **Mass assignment**: nunca `await this.userModel.create(req.body)`. Siempre pasar por DTO + `class-transformer` con `excludeExtraneousValues: true`.
- **Índices únicos** donde corresponda (`email`, `sku`) para evitar duplicados que rompan invariantes.
- **Validación de tipos**: schemas Mongoose con `type: String`, `required`, `min`, `max`.
- **No retornar `passwordHash`**: schema con `toJSON: { transform: (_, ret) => { delete ret.passwordHash; return ret; } }` o DTO de salida.
- **Encriptación at-rest**: configurar en el motor (WiredTiger encryption) o usar Atlas con encryption at rest.

### 5.3 Connection string

```
mongodb://user:STRONG_PASS@mongo-host:27017/db?authSource=admin&retryWrites=true&w=majority&tls=true
```

Nunca en código. Solo en `.env` o secret manager.

## 6. Headers HTTP de seguridad (Helmet)

```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
}));
```

## 7. CORS

```ts
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? false, // whitelist explícita
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'x-correlation-id'],
});
```

Nunca `origin: '*'` con `credentials: true` (es un error de seguridad común).

## 8. Validación de entrada

`ValidationPipe` global con:

```ts
new ValidationPipe({
  whitelist: true,                  // descarta propiedades no declaradas en DTO
  forbidNonWhitelisted: true,       // 400 si vienen propiedades extra
  transform: true,                  // convierte tipos según DTO
  transformOptions: { enableImplicitConversion: false },
  disableErrorMessages: process.env.NODE_ENV === 'production', // no filtrar estructura interna
});
```

DTOs con `class-validator`:

```ts
export class CreateProductDto {
  @IsString() @MinLength(3) @MaxLength(40)
  sku!: string;

  @IsString() @MinLength(3) @MaxLength(120)
  name!: string;

  @IsNumber() @Min(0.01) @Max(1_000_000)
  @Type(() => Number)
  price!: number;

  @IsInt() @Min(0)
  @Type(() => Number)
  stock!: number;
}
```

## 9. Secrets y configuración

- **Nunca** en repo: `.env` en `.gitignore`; sólo `.env.example` versionado.
- Validación al boot con Joi/Zod (`@nestjs/config` `validationSchema`). Si falta una variable obligatoria, el proceso no arranca.
- Producción real: AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault.
- Rotación periódica de `JWT_*_SECRET` (con grace period en la verificación).

## 10. Logging y observabilidad

- **Pino** como logger en cada servicio. JSON estructurado.
- **Nunca loggear**: passwords, tokens completos, datos personales sensibles. Solo IDs y correlation-id.
- **Correlation-ID** generado en gateway y propagado a todos los servicios + frontend.
- En producción: agregar a stack ELK/Loki para búsqueda + alertas.

## 11. Despliegue de microservicios en la nube (respuesta Ej. 5)

### 11.1 Plataforma

- **Kubernetes** (EKS, GKE, AKS) para orquestación.
- **API Gateway gestionado** (AWS API Gateway, Kong, Ambassador) delante del cluster.
- **Service mesh** (Istio/Linkerd) para mTLS entre servicios + observabilidad.

### 11.2 Networking

- **VPC privada** — servicios no expuestos directamente.
- Solo el ingress (Load Balancer) tiene IP pública.
- **Security Groups** estrictos: gateway acepta 443, servicios solo aceptan tráfico desde el namespace del gateway.

### 11.3 Secrets

- **Sealed Secrets** o **External Secrets Operator** sincronizando con Vault/AWS SM.
- **IRSA** (IAM Roles for Service Accounts) en EKS — cada pod tiene su rol sin manejar credenciales.

### 11.4 Imágenes

- Build en CI/CD; **escaneo de vulnerabilidades** (Trivy, Snyk).
- Imágenes firmadas (Cosign) y verificadas en admisión (Kyverno/OPA).
- Base images mínimas (`node:20-alpine` o **distroless**).
- Usuario no root en el contenedor (`USER node`).
- `readOnlyRootFilesystem: true` cuando sea posible.

### 11.5 TLS

- **End-to-end**: Let's Encrypt (cert-manager) en ingress, mTLS interno con service mesh.
- HSTS, redirect 80 → 443.

### 11.6 Observabilidad

- **Logs**: Loki / CloudWatch Logs.
- **Métricas**: Prometheus + Grafana.
- **Tracing**: OpenTelemetry → Jaeger/Tempo.
- **Alertas**: PagerDuty / Opsgenie sobre umbrales (latencia p99, error rate, saturation).

### 11.7 Disponibilidad

- HPA basado en CPU + custom metrics.
- Pod Disruption Budgets.
- Multi-AZ.
- Health checks (`/health` liveness + readiness).
- Graceful shutdown (`SIGTERM` handler en NestJS).

## 12. Checklist OWASP API Top 10 (2023)

| Riesgo | Mitigación en este proyecto |
|--------|----------------------------|
| **API1: BOLA** (Broken Object Level Auth) | Cada query filtra por `userId`/`tenantId` cuando aplica. No se confía en IDs del cliente para autorización. |
| **API2: Broken Authentication** | JWT con TTL corto, refresh rotativo, bcrypt cost 12, rate-limit en login. |
| **API3: BOPLA** (Property Level Auth) | DTOs estrictos, `@Exclude()` en campos sensibles. |
| **API4: Unrestricted Resource Consumption** | Rate limiting + `limit` máximo en paginación (`limit ≤ 100`). |
| **API5: Function Level Auth** | `RolesGuard` + `@Roles('admin')` en mutaciones. |
| **API6: SSRF** | Si el gateway permite URLs configurables, validar contra whitelist. *No aplica aquí.* |
| **API7: Security Misconfig** | Helmet, CORS estricto, `disableErrorMessages` en prod, sin stack en respuestas. |
| **API8: Injection** | DTOs validados, `express-mongo-sanitize`, sin string concat para queries. |
| **API9: Improper Inventory** | Swagger por servicio + README con endpoints disponibles. |
| **API10: Unsafe Consumption of APIs** | No se consumen APIs externas en esta prueba. |

## 13. Hardening de supply-chain (npm/pnpm)

> Sección crítica. El ecosistema npm sufrió múltiples ataques de supply-chain entre 2024 y 2026 (Nx s1ngularity, chalk/debug compromise, Shai-Hulud 1.0/2.0, axios norcoreano de marzo 2026). Esta sección documenta las defensas aplicadas en este proyecto.

### 13.1 Ataques relevantes a tener en cuenta

| Incidente | Fecha | Tipo | Lección |
|-----------|-------|------|---------|
| **lottie-player** | Oct 2024 | Token de mantenedor robado → versiones con malware Web3 | Token-rotation + 2FA hardware |
| **tj-actions/changed-files** (CVE-2025-30066) | Mar 2025 | Tags reescritos en GitHub Actions | Pinear actions por SHA, no por tag |
| **Nx s1ngularity** | Ago 2025 | Postinstall malicioso usaba CLIs de IA local (Claude/Gemini) para recon | `allowBuilds` whitelist + cooldown |
| **chalk/debug compromise** | Sep 2025 | 18 paquetes con 2.6B descargas/sem inyectaron cryptostealer (2h hasta reversión) | `minimumReleaseAge` (cooldown) |
| **Shai-Hulud 1.0** | Sep 2025 | Primer worm npm auto-replicante (~200 paquetes) | Bloquear postinstall por default |
| **Shai-Hulud 2.0** | Nov 2025 | Resurgencia: 796 paquetes, 1.092 versiones, 25k repos GitHub | `pnpm audit signatures` |
| **axios norcoreano** | Mar 2026 | Versiones `1.14.1`/`0.30.4` publicadas directamente como malware estatal NK | Versión fija + audit + cooldown |

### 13.2 Defensas implementadas en este proyecto

**Versiones del runtime (auditadas al 2026-05-20):**
- **Node.js 22.22.3 LTS** — `node:22.22.3-bookworm-slim` en Dockerfiles. Versiones previas (22.13–22.21) tienen ≥ 8 CVEs sin parchar incluyendo:
  - CVE-2025-55130 (high, bypass del Permission Model vía symlinks)
  - CVE-2025-55131 (high, race condition en `Buffer.alloc`)
  - CVE-2025-59465 (high, DoS HTTP/2)
  - CVE-2025-59464 (medium, memory leak en TLS)
  - CVE-2025-59466, CVE-2026-21636, CVE-2026-21637, CVE-2025-55132
- **pnpm 11.1.3** — `pnpm@11.1.3` exacto (no `^11.0.0`). 11.0.0 tenía bugs operativos del ciclo nuevo; 11.1.x los limpió. **Sin CVE** contra pnpm 11.x.
- **Imagen `bookworm-slim` (no Alpine)** — el proyecto usa `bcrypt` (módulo nativo) y los drivers nativos de MongoDB. Alpine + musl puede romper esos en runtime de forma silenciosa.
- **Usuario non-root `node` (uid 1000)** — viene built-in en las imágenes oficiales de Node, no creamos uno propio.
- **EOL Node 22**: abril 2027. Para proyectos nuevos en 2026+, Node 24 sería la elección Active LTS — Node 22 sigue siendo válido pero está en Maintenance.

**Archivos de configuración:**

- [`/.npmrc`](../.npmrc) — flags defensivos a nivel de instalación:
  - `frozen-lockfile=true` — falla si `pnpm-lock.yaml` divergió.
  - `minimum-release-age=1440` — no instala paquetes publicados hace < 24 h.
  - `block-exotic-subdeps=true` — bloquea deps de URLs git/tarball.
  - ~~`trust-policy=no-downgrade`~~ — **deshabilitado por pragmatismo** (ver §13.5).
  - `registry=https://registry.npmjs.org/` — fijo, evita mirror inseguro.

- [`/pnpm-workspace.yaml`](../pnpm-workspace.yaml) — `allowBuilds` con lista blanca explícita de paquetes que pueden ejecutar postinstall. Todo lo demás es bloqueado por pnpm 10+.

- [`/pnpm-workspace.yaml`](../pnpm-workspace.yaml) — `overrides` fuerza versiones seguras en transitivas conocidas como problemáticas (pnpm 11+ lee desde aquí, ya no desde `package.json`):
  - `axios: ^1.16.0` (CVE-2025-62718 SSRF)
  - `mongoose: ^8.9.5` (CVE-2025-23061 RCE)
  - `cross-spawn: ^7.0.6` (CVE-2024-21538 ReDoS)
  - `cookie: ^0.7.2` (CVE-2024-47764)
  - `tar: ^7.5.11` (6 CVEs: path traversal, file overwrite, race condition)
  - `multer: ^2.1.1` (3 CVEs DoS)
  - `lodash: ^4.17.24` (CVE-2021-23337 code injection)
  - `js-yaml: ^4.1.1` (prototype pollution)
  - `file-type: ^21.3.2` (infinite loop + ZIP bomb)

- **NestJS 11.1.18+** en todos los servicios — fix de GHSA-36xv-jgw5-4q75 ("Improperly Neutralizes Special Elements"). NestJS 10 no recibe el patch; el upgrade a v11 era necesario.

### 13.3 Versiones de dependencias auditadas (al 2026-05-20)

| Paquete | Versión usada | Razón |
|---------|---------------|-------|
| `@nestjs/*` | `^11.1.18` (todo el ecosistema) | GHSA-36xv-jgw5-4q75 (Improper Neutralization). NestJS 10 sin parche. |
| `mongoose` | `^8.9.5` | CVE-2025-23061 (RCE vía `$where`) — `<8.9.5` es vulnerable |
| `axios` | `^1.16.0` | CVE-2025-62718 (SSRF NO_PROXY bypass). Versiones `1.14.1` y `0.30.4` son **malware NK** (marzo 2026). |
| `tar` | `^7.5.11` | 6 CVEs (path traversal, file overwrite, race) — viene como transitiva via bcrypt |
| `multer` | `^2.1.1` | 3 CVEs DoS — viene via `@nestjs/platform-express` |
| `lodash` | `^4.17.24` | CVE-2021-23337 code injection via `_.template` |
| `js-yaml` | `^4.1.1` | Prototype pollution en merge — via tooling |
| `file-type` | `^21.3.2` | Infinite loop ASF + ZIP bomb |
| `helmet` | `^8.1.0` | Última estable |
| `uuid` | `^11.1.0` | CVE-2026-41907 (v3/v5/v6) |
| `eslint-config-prettier` | `^10.1.8` | Versión post-recovery del compromiso CVE-2025-54313 |
| `bcrypt` | `^5.1.1` | Sin CVEs en 5.1.x. OWASP 2025 prefiere argon2id; bcrypt sigue aceptable. |
| `class-validator` | `^0.14.1` | Sin CVE en 0.14.x |
| `passport-jwt` | `^4.0.1` | Sin CVE; **forzar `algorithms: ['HS256']`** en config. |

### 13.4 Paquetes deprecated removidos

| Paquete | Razón | Reemplazo |
|---------|-------|-----------|
| `express-mongo-sanitize` | Sin releases desde enero 2022, roto en Express 5 (muta `req.query` read-only) | Defensa en capas: `ValidationPipe` estricto + `mongoose.set('sanitizeFilter', true)` + schemas Mongoose estrictos (ver §5.2) |

### 13.5 Trade-off: por qué `trustPolicy: no-downgrade` está deshabilitado

Durante la instalación inicial probamos `trustPolicy: no-downgrade` y bloqueó múltiples paquetes legítimos:

| Paquete | Motivo del bloqueo |
|---------|--------------------|
| `eslint-config-prettier@9.1.2` | Versión `9.x` sin npm provenance attestation tras CVE-2025-54313 (resuelto, mitigado bumpeando a `^10.1.8`). |
| `ts-jest@29.4.10` | Versión sin trusted-publisher attestation; versiones previas sí la tenían. No hay indicios de compromiso. |

**Análisis:** la mayoría de los paquetes JS aún no usa npm provenance attestation (feature relativamente nuevo, ~2023). `trustPolicy: no-downgrade` genera **muchos falsos positivos** sin ataque real, bloqueando el install.

**Decisión:** se desactiva `trustPolicy`. Las defensas que **sí** se mantienen y son efectivas:

- ✅ **`minimumReleaseAge: 1440`** (24h cooldown) — la defensa **más fuerte** contra ataques activos. Habría mitigado todos los ataques de 2024-2026 (chalk/debug revertido en 2h, Shai-Hulud, axios NK).
- ✅ **`onlyBuiltDependencies` whitelist** — bloquea postinstall arbitrarios.
- ✅ **`blockExoticSubdeps`** — bloquea deps de URLs git/tarball externos.
- ✅ **`pnpm audit --prod --audit-level=high`** — gate en CI.
- ✅ **`pnpm.overrides`** — versiones seguras forzadas en transitivas conocidas.

Cuando npm provenance attestation sea más universal (esperable en 2027+), reactivar `trustPolicy: no-downgrade` será viable.

### 13.6 Comandos de auditoría

Ejecutar antes de cualquier build/deploy:

```bash
# 1. Auditar CVEs en deps de producción (falla si hay high/critical)
pnpm audit --prod --audit-level=high

# 2. Verificar firmas ECDSA del registry (pnpm 11.1+)
pnpm audit signatures

# 3. Combinado (alias en package.json)
pnpm audit:full

# 4. Ver duplicados (a veces hay 2 versiones de la misma lib y una es vulnerable)
pnpm why <paquete>

# 5. Ver qué builds bloqueó pnpm — revisar manualmente y agregar a allowBuilds si aplica
pnpm install --dry-run 2>&1 | grep -i 'ignored'
```

### 13.7 Recomendaciones para entornos reales (no scope de la prueba)

- **2FA con WebAuthn/hardware key** en cuentas npm (no SMS, no TOTP) — el ataque chalk/debug fue por phishing de reset 2FA.
- **Pinear GitHub Actions por SHA**: `uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11` (no `@v4`).
- **Socket.dev** GitHub App: detección de comportamiento sospechoso (postinstall, network, ofuscación) — habría detectado chalk/debug en minutos. Gratuito en open source.
- **`pnpm audit` como gate de CI** que falla el build en high/critical.
- **Snapshot/diff de `pnpm-lock.yaml`** en cada PR: si cambió sin tocar `package.json`, revisar manualmente.
- **Mirror corporativo** (Verdaccio, Cloudsmith, Sonatype) con allow-list para deps en producción.

## 14. Checklist final pre-entrega

- [ ] `.env` no versionado, `.env.example` presente.
- [ ] No hay tokens, secrets o passwords hardcodeados (`grep -r "password\|secret" --include="*.ts"`).
- [ ] Helmet, CORS, ValidationPipe globales en cada servicio.
- [ ] Rate-limit en login y global del gateway.
- [ ] `passwordHash` excluido de toda respuesta JSON.
- [ ] Errores en producción no incluyen stack traces.
- [ ] CSP configurado en frontend (header en nginx).
- [ ] Dependencias auditadas: `pnpm audit --prod --audit-level=high` sin findings.
- [ ] Firmas verificadas: `pnpm audit signatures` sin errores.
- [ ] Sin paquetes deprecated en uso (`express-mongo-sanitize`, etc.).
- [ ] `pnpm-lock.yaml` versionado y reproducible (`--frozen-lockfile`).
- [ ] Docker images corren como non-root.
- [ ] Node ≥ 22.11 LTS + pnpm ≥ 11.0 (validado por `engines`).
- [ ] `mongoose.set('sanitizeFilter', true)` aplicado globalmente en servicios con Mongo.
- [ ] JWT verificación con `algorithms: ['HS256']` explícito (nunca `none`).
