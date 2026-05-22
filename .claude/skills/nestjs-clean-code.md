---
name: nestjs-clean-code
description: Use when writing, reviewing, or refactoring NestJS code in this project. Enforces Clean Architecture layering (domain/application/infrastructure/interface), DTO validation, SOLID, and security defaults (Helmet, CORS, ValidationPipe with whitelist+forbidNonWhitelisted, no secrets in code). Triggers — Spanish "código NestJS", "controller", "service Nest", "módulo NestJS", "caso de uso" — English "NestJS code", "Nest controller", "Nest service", "use case".
---

# NestJS Clean Code (PeaKu-prueba)

You are reviewing or writing NestJS code for this project. Apply these rules **strictly**.

## Architectural rules (Clean Architecture)

Every microservice (`apps/auth-service`, `apps/products-service`, `apps/api-gateway`) follows the layered structure documented in `docs/01-arquitectura.md` §3:

```
domain/         → entities + repository interfaces (no external deps)
application/    → use cases + DTOs (orchestration only)
infrastructure/ → adapters: Mongoose, bcrypt, JWT, HTTP clients
interface/      → controllers (HTTP layer)
```

**Dependency rule (must hold):**
- `domain` depends on **nothing**.
- `application` depends only on `domain`.
- `infrastructure` may depend on `application` + `domain`.
- `interface` orchestrates — depends on `application`.

**Red flags to call out and fix:**
- A use case importing `Model` from `mongoose` → MOVE to infrastructure, inject repository interface.
- A controller doing business logic directly → MUST delegate to a use case.
- Mongoose schema decorated with `class-validator` → keep validation in DTOs, schemas only for persistence shape.
- Domain entities importing from `@nestjs/*` → not allowed, domain is framework-free.

## Mandatory NestJS configuration

When generating `main.ts` for any service, include:

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.use(helmet({ /* CSP, HSTS, frameguard */ }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? false,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  app.setGlobalPrefix('api/v1');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('...')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
```

If any of these are missing, flag as 🔴 critical.

## DTO rules

- One DTO per use case (`CreateProductDto`, `UpdateProductDto`, `ListProductsQueryDto`).
- Every property has a `class-validator` decorator (`@IsString`, `@IsEmail`, `@IsInt`, `@Min`, `@Max`, etc.).
- Use `@Type(() => Number)` from `class-transformer` for query/body number coercion.
- Use `PartialType()` for update DTOs.
- Never reuse Mongoose schemas as DTOs.
- Output DTOs (response shapes) use `@Expose()` + `excludeExtraneousValues: true` to prevent accidental field leaks.

## Repository / DI rules

- Define repository interface in `domain/` (e.g., `ProductRepository`).
- Implement in `infrastructure/persistence/` (e.g., `MongoProductRepository`).
- Bind via token: `{ provide: PRODUCT_REPOSITORY_TOKEN, useClass: MongoProductRepository }`.
- Use cases inject the token: `@Inject(PRODUCT_REPOSITORY_TOKEN) private readonly repo: ProductRepository`.
- Never `@InjectModel` inside use cases.

## Security defaults (must verify)

- `process.env` access **only** through `ConfigService` with validated schema (Joi/Zod).
- JWT secret never hardcoded; loaded from env with validation that it's ≥ 32 chars.
- bcrypt cost ≥ 12.
- Login endpoint has `@Throttle({ default: { limit: 10, ttl: 60_000 } })`.
- `passwordHash` never appears in any response (verify via output DTO or `toJSON` transform).
- Errors in production omit stack traces (configured in exception filter).
- Mongo queries never built from string concatenation; always via Mongoose typed methods.

## Error handling

- Throw `NotFoundException`, `ConflictException`, `UnauthorizedException`, `BadRequestException` from use cases.
- Don't throw raw `Error`.
- Custom domain errors live in `domain/errors/` and are mapped to HTTP in interface layer.
- All responses follow shape `{ statusCode, message, error, correlationId, timestamp }`.

## Testing rules

- Each use case has a unit test in `*.spec.ts` next to the file.
- Mock dependencies (use Jest `createMock` from `@golevelup/ts-jest` or hand-rolled).
- e2e test for at least the happy path per controller, using `supertest` + `mongodb-memory-server`.

## When generating code

1. Generate the **interface (port) first**, then implementation.
2. Show the test alongside the code, not as an afterthought.
3. Reference the doc: `// see docs/01-arquitectura.md §3` when a non-trivial pattern is applied.
4. Never write multi-line comment blocks explaining what the code does. Names + types should self-document.

## Output format when reviewing existing code

```
🔴 Critical (security/correctness)
  - <file>:<line> — <issue> → <fix>

🟡 Important (architecture/maintainability)
  - <file>:<line> — <issue> → <fix>

🟢 Nice to have (style/minor)
  - <file>:<line> — <issue> → <fix>
```

Always include the **exact path + line** so the dev can jump to it.
