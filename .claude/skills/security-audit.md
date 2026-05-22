---
name: security-audit
description: Audit code for common web/API vulnerabilities aligned with OWASP API Top 10 and the project's security plan (docs/04-seguridad.md). Checks JWT handling, input validation, NoSQL injection, secrets, CORS, rate limiting, password storage, error verbosity, frontend token storage, AND supply-chain hygiene (lockfile, audit signatures, allowBuilds whitelist, deprecated transitives). Use ALSO proactively after any dependency change is committed. Triggers — Spanish "auditá seguridad", "revisá vulnerabilidades", "chequeo de seguridad", "después de actualizar deps", "antes de mergear" — English "security audit", "check vulnerabilities", "OWASP review", "security review", "post-install audit", "before merging".

For PRE-install gating of new packages or version bumps, use the dedicated skill `dependency-security-check` first.
---

# Security Audit (PeaKu-prueba)

You are auditing this project's code for security issues. Follow the checklist below in order. For each finding emit: severity, file:line, issue, fix, link to relevant section of `docs/04-seguridad.md`.

## Scope

- All `apps/*` services (backend) and the Angular frontend.
- Configuration files: `docker-compose.yml`, `.env.example`, nginx configs.
- Dependency manifests: `package.json`, `pnpm-lock.yaml`.

## Checklist

### 1. Secrets & configuration

- [ ] No hardcoded secrets, tokens, passwords, JWT signing keys.
  - grep for: `secret = "`, `password:`, `apiKey`, `Bearer ` followed by a literal, `mongodb://.*:.*@`.
- [ ] `.env` is in `.gitignore`. `.env.example` is committed with placeholders only.
- [ ] Env validation at boot (Joi or Zod schema in `@nestjs/config`).
- [ ] No `process.env.X` direct access scattered in code — only via `ConfigService`.

🔴 if any secret in code. 🔴 if `.env` is staged.

### 2. JWT

- [ ] `JWT_ACCESS_SECRET` length ≥ 32 chars in `.env.example` comment.
- [ ] Algorithm pinned (HS256 minimum, RS256 ideal). Never `none`.
- [ ] `expiresIn` set (15 min access, 7 days refresh).
- [ ] Refresh token hash stored in DB and rotated on use.
- [ ] Token verification includes `iss` and `aud` claims if set.
- [ ] No `jwt.decode()` used for trust decisions — must be `jwt.verify()`.

🔴 if any of the above missing.

### 3. Password handling

- [ ] bcrypt cost ≥ 12.
- [ ] No SHA-only / MD5 / plaintext password storage.
- [ ] No password ever logged or returned in any response.
- [ ] No password in URL/query string (only POST body).
- [ ] Constant-time comparison (`bcrypt.compare`) for verification — never `===`.

### 4. Input validation

- [ ] Every controller method's params/body/query is a DTO with `class-validator` decorators.
- [ ] `ValidationPipe` globally configured with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- [ ] No `req.body` accessed directly (raw, untyped).
- [ ] Update operations don't accept `_id` from the body (mass assignment).

### 5. NoSQL injection

- [ ] `express-mongo-sanitize` (or equivalent) middleware enabled in each service.
- [ ] No query operators (`$where`, `$gt`, `$ne`) accepted as user input.
- [ ] Mongoose queries built via typed methods (`findOne({ email })`), never string-concatenated.
- [ ] User-supplied regex always anchored + sanitized to avoid ReDoS (or use `escape-string-regexp`).

### 6. CORS

- [ ] `origin` is a whitelist from `CORS_ORIGINS` env var.
- [ ] Never `origin: '*'` combined with `credentials: true`.
- [ ] `allowedHeaders` restrictive (`Authorization`, `Content-Type`, `x-correlation-id`).

### 7. HTTP headers

- [ ] Helmet enabled in every NestJS service.
- [ ] CSP defined for the frontend (in nginx conf).
- [ ] HSTS enabled when behind HTTPS (`maxAge ≥ 1 year`).
- [ ] `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`).
- [ ] `Referrer-Policy: no-referrer` or `strict-origin-when-cross-origin`.

### 8. Rate limiting

- [ ] `@nestjs/throttler` configured globally on the gateway (60 req/min/IP).
- [ ] `/auth/login` and `/auth/register` have stricter limits (10/min/IP).
- [ ] Login failure handling does not leak whether the email exists.

### 9. Errors & logging

- [ ] Global exception filter in each service.
- [ ] Production responses do not include stack traces.
- [ ] Logs use structured JSON (pino) and never include passwords, full tokens, or PII.
- [ ] Correlation-ID is present in every log line.

### 10. Authorization (BOLA / BFLA)

- [ ] Every mutation checks ownership (`if (resource.userId !== currentUser.id) throw ForbiddenException`).
- [ ] `@Roles('admin')` on admin-only endpoints (POST/PATCH/DELETE products).
- [ ] No client-supplied `userId` trusted for authorization.

### 11. Frontend specific

- [ ] No `eval()`, `new Function()`, `[innerHTML]` with user data without sanitizer.
- [ ] Refresh token stored in `sessionStorage` (or HttpOnly cookie — best case).
- [ ] No tokens in URL fragments persisted to history.
- [ ] CSP header in nginx blocks inline scripts (`script-src 'self'`).
- [ ] All form inputs sanitized for XSS-prone fields (Angular's default binding is safe; `innerHTML` is not).

### 12. Docker & deployment

- [ ] Containers run as non-root (`USER node`).
- [ ] Base images are pinned (`node:20.11-alpine`, not `node:latest`).
- [ ] No secrets in Dockerfiles (`ENV JWT_SECRET=...` ❌).
- [ ] MongoDB containers have `MONGO_INITDB_ROOT_USERNAME` + strong password from env.
- [ ] Only the gateway port is published to the host. Internal services use the docker network.

### 13. Dependencies

- [ ] `pnpm audit --prod` returns 0 high/critical.
- [ ] No deprecated packages with known CVEs (request, node-fetch < 3, etc.).
- [ ] All major dependencies < 2 majors behind latest.

## Output format

```
Security Audit — <date>

Critical (🔴) — N findings
  1. apps/auth-service/src/.../jwt.module.ts:14
     → JWT secret defaulted to "changeme" if env missing.
     Fix: throw at boot via Joi validation. See docs/04-seguridad.md §9.

Important (🟡) — N findings
  ...

Recommendations (🟢) — N findings
  ...

Summary: X critical, Y important, Z recommendations.
Status: NOT READY TO MERGE / READY WITH FIXES / READY.
```

If status is NOT READY, do not let user merge without addressing 🔴.
