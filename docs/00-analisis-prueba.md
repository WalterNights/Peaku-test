# 00 — Análisis Central de la Prueba Técnica

> Documento base. Resume el contenido del PDF `Prueba_Tecnica_FullStack.pdf`, identifica criterios de evaluación, riesgos y decisiones tomadas.

---

## 1. Objetivo de la prueba

Evaluar competencias en desarrollo **Full Stack** (Backend, Frontend, Arquitectura) y la capacidad de utilizar **herramientas de IA** de manera consciente, crítica y productiva.

## 2. Ejercicios

| # | Tipo | Tema | Esfuerzo estimado |
|---|------|------|-------------------|
| 1 | Práctico | Backend NestJS + MongoDB (CRUD productos, validaciones, Swagger, JWT) | 4-6 h |
| 2 | Práctico | Frontend Angular (CRUD, paginación, state management, responsive) | 4-6 h |
| 3 | Teórico | Arquitectura microservicios para e-commerce agropecuario | 1-2 h |
| 4 | Teórico | ≥3 técnicas de optimización web (foco móvil) | 1 h |
| 5 | Teórico | Seguridad: OAuth vs JWT, fuerza bruta, MongoDB, despliegue cloud | 1-2 h |

## 3. Criterios de evaluación (textuales del PDF)

1. Calidad y estructura del código.
2. Correcta implementación de backend y frontend.
3. Buenas prácticas de seguridad y rendimiento.
4. Claridad en arquitectura.
5. Uso consciente de IA.
6. Capacidad de explicación de la solución.

## 4. Entregables exigidos

- [ ] Código en repositorio público (o ZIP).
- [ ] PDF con respuestas teóricas (Ej. 3, 4, 5).
- [ ] Sección documentando uso de IA: herramientas, prompts relevantes, validación.

## 5. Decisiones estratégicas

### 5.1 Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Runtime | Node.js ≥ 22.11 LTS + pnpm ≥ 11.0 | Node 20 EOL desde 2026-04-30. pnpm 11 trae `minimumReleaseAge` y `allowBuilds` (defensa supply-chain) |
| Backend | NestJS 11.1.18+ + MongoDB 7 (Mongoose 8.9.5+) | Exigido por el enunciado. NestJS 11 resuelve CVE GHSA-36xv-jgw5-4q75; Mongoose 8.9.5 resuelve CVE-2025-23061 |
| Frontend | **Angular 18+** (standalone components + signals) | Elegido por el candidato; muestra dominio de un framework empresarial |
| State Management | **NgRx Signal Store** | Moderno, alineado con Angular Signals; menos boilerplate que NgRx clásico sin perder el patrón Redux |
| UI | **Angular Material** + Tailwind CSS | Material resuelve tabla paginada + responsive nativamente; Tailwind para custom layout |
| Auth | JWT (access + refresh) | Exigido |
| Docs API | Swagger / OpenAPI | Exigido |
| Containerización | Docker + docker-compose | Permite levantar todo el stack con un comando |

### 5.2 Arquitectura

A pesar de que el enunciado del Ej. 1 pide "una API básica", se decide implementar la solución con **arquitectura de microservicios pragmática**:

- **api-gateway** — punto de entrada único, valida JWT y enruta a servicios internos.
- **auth-service** — gestión de usuarios, login, emisión de tokens.
- **products-service** — CRUD de productos (núcleo del Ej. 1).
- **frontend** — SPA Angular que sólo conoce al gateway.

> Esto convierte el Ej. 1 en una demostración viva del Ej. 3 (arquitectura de microservicios), aumentando la cohesión de la entrega.

Detalle completo en [`01-arquitectura.md`](./01-arquitectura.md).

### 5.3 Principios rectores

- **SOLID** aplicado en cada servicio.
- **Clean Architecture** por capas: `domain → application → infrastructure → interface`.
- **DTOs + class-validator** para todo input externo (defensa en profundidad).
- **Seguridad por defecto**: helmet, rate-limit, CORS estricto, no secrets en código.
- **Tests** mínimos: unitarios de servicios + e2e de un endpoint crítico (login + crear producto).

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Sobre-ingeniería para una prueba | Mantener servicios pequeños, sin Kafka/K8s. Documentar trade-offs explícitamente. |
| JWT mal implementado (sin refresh, secrets hardcodeados) | Plan de seguridad dedicado en [`04-seguridad.md`](./04-seguridad.md). |
| Frontend genérico que no destaca | Aplicar Signal Store + Material + accesibilidad básica (ARIA, keyboard nav). |
| Documentación de IA pobre | Registrar prompts críticos a medida que se trabaja, no al final. Ver [`05-uso-ia.md`](./05-uso-ia.md). |
| Caja negra: revisor no entiende cómo correrlo | README claro con `docker-compose up` como happy path. |

## 7. Alcance explícito

**Dentro de alcance:**

- 3 microservicios (gateway, auth, products) + SPA Angular.
- Docker compose con MongoDB.
- Swagger por servicio.
- Tests unitarios básicos.
- Documentación completa.

**Fuera de alcance (declarado):**

- Kubernetes, service mesh, observability stack (Prometheus/Grafana).
- Message broker (RabbitMQ/Kafka) — mencionado en docs pero no implementado.
- CI/CD pipelines (mencionado en `04-seguridad.md` como next step).
- i18n / soporte multi-idioma del frontend.

## 8. Mapeo ejercicios → entregables

| Ejercicio | Entregable |
|-----------|------------|
| Ej. 1 | Código `apps/products-service` + `apps/auth-service` + `apps/api-gateway` + Swagger (estándar en [`06-swagger.md`](./06-swagger.md)) |
| Ej. 2 | Código `apps/frontend` |
| Ej. 3 | [`01-arquitectura.md`](./01-arquitectura.md) + diagrama |
| Ej. 4 | Sección en PDF teórico (basado en [`03-plan-frontend.md`](./03-plan-frontend.md) §performance) |
| Ej. 5 | Sección en PDF teórico (basado en [`04-seguridad.md`](./04-seguridad.md)) |
| Uso IA | [`05-uso-ia.md`](./05-uso-ia.md) |
