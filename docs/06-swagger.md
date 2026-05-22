# 06 — Documentación API con Swagger / OpenAPI

> Cumple con el requisito explícito del PDF (Ej. 1): *"Documentación con Swagger"*. Este documento define el estándar de documentación de cada microservicio.

---

## 1. Objetivo

Cada microservicio expone una documentación OpenAPI 3.0 navegable que permita a un evaluador (o consumidor) probar endpoints sin leer código fuente.

Requisitos no negociables:

- Cada endpoint documentado: descripción, body, query, params, respuestas posibles.
- Esquemas de DTO generados automáticamente desde decoradores.
- Botón "Authorize" para pegar el JWT y probar endpoints protegidos.
- Ejemplos de request y response (no solo el shape).
- Versionado: `/api/v1` en la URL + `version` en el OpenAPI document.

## 2. Stack

- **`@nestjs/swagger`** (>= 7.x) — generación automática desde decoradores.
- **`swagger-ui-express`** (incluido) — UI interactiva.
- **`class-validator` + `class-transformer`** — convierten DTOs en schemas.

## 3. Endpoints expuestos por servicio

| Servicio | URL Swagger | URL JSON | Puerto |
|----------|-------------|----------|--------|
| api-gateway | `http://localhost:4050/api/docs` | `http://localhost:4050/api/docs-json` | 4050 |
| auth-service | `http://localhost:3001/api/docs` | `http://localhost:3001/api/docs-json` | 3001 |
| products-service | `http://localhost:3002/api/docs` | `http://localhost:3002/api/docs-json` | 3002 |

> En producción, `auth-service` y `products-service` no están expuestos al exterior. Para inspeccionarlos en dev, se publican sus puertos en `docker-compose.yml`.

## 4. Setup base (snippet común en cada `main.ts`)

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... helmet, cors, pipes, etc.

  const config = new DocumentBuilder()
    .setTitle('Auth Service · PeaKu')
    .setDescription('Servicio de autenticación: registro, login y rotación de refresh tokens.')
    .setVersion('1.0.0')
    .setContact('PeaKu Team', 'https://github.com/WalterNights/Peaku-test', 'noreply@peaku.test')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header', name: 'Authorization' },
      'access-token',
    )
    .addServer(process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`)
    .addTag('auth', 'Endpoints de autenticación')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,      // mantiene el JWT pegado entre recargas
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'list',
    },
    customSiteTitle: 'PeaKu · Auth API',
  });

  await app.listen(process.env.PORT ?? 3001);
}
```

Cambia título / descripción / puerto por servicio.

## 5. Convenciones para anotar el código

### 5.1 Controllers

```ts
@ApiTags('products')
@ApiBearerAuth('access-token')
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear producto', description: 'Crea un producto en el catálogo. Requiere rol admin.' })
  @ApiCreatedResponse({ description: 'Producto creado', type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Validación falló' })
  @ApiConflictResponse({ description: 'SKU duplicado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Usuario sin rol admin' })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.createProductUseCase.execute(dto);
  }
}
```

Regla: **cada respuesta posible (2xx, 4xx, 5xx) debe estar declarada** con su decorator correspondiente. Sin esto la doc queda incompleta y los consumidores no saben qué errores manejar.

### 5.2 DTOs de entrada

```ts
export class CreateProductDto {
  @ApiProperty({ example: 'SOJA-2024-001', description: 'SKU único del producto' })
  @IsString() @MinLength(3) @MaxLength(40)
  sku!: string;

  @ApiProperty({ example: 'Soja Premium Cosecha 2024', minLength: 3, maxLength: 120 })
  @IsString() @MinLength(3) @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Lote A-7, certificación orgánica' })
  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 480.50, minimum: 0.01, description: 'Precio en USD' })
  @IsNumber() @Min(0.01) @Type(() => Number)
  price!: number;

  @ApiProperty({ example: 1500, minimum: 0, description: 'Stock disponible (toneladas)' })
  @IsInt() @Min(0) @Type(() => Number)
  stock!: number;

  @ApiProperty({ example: 'cereales', enum: ['cereales', 'oleaginosas', 'forrajeras', 'otros'] })
  @IsIn(['cereales', 'oleaginosas', 'forrajeras', 'otros'])
  category!: string;
}
```

> Los `@ApiProperty` decorators son redundantes con `class-validator` solo en parte. Sin ellos, el ejemplo en Swagger UI sale vacío y los `enum`/`minimum`/`maximum` no se reflejan.

### 5.3 DTOs de salida (response)

Definir un DTO de **respuesta** explícito (no devolver la entidad Mongoose):

```ts
export class ProductResponseDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'SOJA-2024-001' })
  sku!: string;

  @ApiProperty({ example: 'Soja Premium Cosecha 2024' })
  name!: string;

  // ... resto de campos

  @ApiProperty({ example: '2025-04-15T10:30:00.000Z' })
  createdAt!: Date;
}
```

> Beneficio doble: documentación + control de qué se expone (nunca `passwordHash` ni `__v` de Mongoose).

### 5.4 Paginación

```ts
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  items!: T[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
```

Para tipar el `items[]` correctamente en Swagger, usar `@ApiExtraModels` + `getSchemaPath`:

```ts
@ApiExtraModels(ProductResponseDto)
@ApiOkResponse({
  schema: {
    allOf: [
      { $ref: getSchemaPath(PaginatedResponseDto) },
      { properties: { items: { type: 'array', items: { $ref: getSchemaPath(ProductResponseDto) } } } },
    ],
  },
})
```

### 5.5 Query params

```ts
@Get()
@ApiOperation({ summary: 'Listar productos paginados' })
@ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
@ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
@ApiQuery({ name: 'category', required: false, enum: ['cereales', 'oleaginosas', 'forrajeras', 'otros'] })
@ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda full-text en name/sku' })
list(@Query() query: ListProductsQueryDto) { /* ... */ }
```

### 5.6 Errores consistentes

Definir un DTO para el envelope de error y reutilizarlo:

```ts
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiPropertyOptional({ type: [Object] })
  details?: Array<{ field: string; issue: string }>;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  correlationId!: string;

  @ApiProperty({ example: '2025-04-15T10:30:00.000Z' })
  timestamp!: string;
}
```

Y en cada endpoint:

```ts
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
```

## 6. Plugin de Nest para reducir boilerplate

Agregar en `nest-cli.json` de cada servicio:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "introspectComments": true,
          "classValidatorShim": true,
          "dtoFileNameSuffix": [".dto.ts"]
        }
      }
    ]
  }
}
```

Esto permite que el plugin infiera `@ApiProperty` desde el tipo TypeScript + comentarios JSDoc, reduciendo verbosidad. Aun así, conviene poner `@ApiProperty({ example: ... })` explícito en campos donde el ejemplo agregue valor.

## 7. Seguridad de la documentación

- En **dev/staging**: Swagger UI accesible.
- En **producción**: dos opciones:
  1. Deshabilitar (`SwaggerModule.setup()` solo si `NODE_ENV !== 'production'`).
  2. Proteger con basic auth o behind VPN.

Recomendación para esta prueba: dejar accesible (es una prueba técnica y el revisor debe verla).

Para entornos reales:

```ts
if (process.env.SWAGGER_ENABLED === 'true') {
  SwaggerModule.setup('api/docs', app, document, /* ... */);
}
```

## 8. Aggregator en el API Gateway (opcional, valor agregado)

El gateway puede ofrecer un único Swagger UI que combine las specs de los servicios downstream. Implementaciones:

- **Manual**: el gateway hace fetch de `/api/docs-json` de cada servicio al arrancar y combina los paths.
- **`swagger-ui-express` con multiple definitions**: opciones para elegir el servicio en un dropdown.

Para esta prueba: el gateway expone su propio Swagger con los endpoints proxy declarados; los servicios internos mantienen sus docs por separado.

## 9. Exportar OpenAPI como artefacto

Para entregar al revisor o usar en Postman/Insomnia:

```ts
// scripts/export-openapi.ts
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Auth').setVersion('1.0.0').build());
  writeFileSync('./openapi.json', JSON.stringify(doc, null, 2));
  await app.close();
}
generate();
```

Script en `package.json`:

```json
{
  "scripts": {
    "openapi:export": "ts-node scripts/export-openapi.ts"
  }
}
```

Commitear `apps/<service>/openapi.json` en `docs/api/` permite que el revisor abra Postman → Import sin levantar el servicio.

## 10. Checklist Swagger por endpoint

Antes de marcar un endpoint como "done":

- [ ] `@ApiTags(...)` en el controller.
- [ ] `@ApiOperation({ summary, description })`.
- [ ] DTO de input con `@ApiProperty` o JSDoc en cada campo (con `example`).
- [ ] DTO de output explícito (no la entidad).
- [ ] `@Api{Created,Ok,Accepted,NoContent}Response` con `type:`.
- [ ] `@Api{BadRequest,Unauthorized,Forbidden,NotFound,Conflict}Response` para errores aplicables.
- [ ] `@ApiBearerAuth('access-token')` si el endpoint requiere auth.
- [ ] Ejemplos legibles (`example: 'SOJA-2024-001'`, no `'string'`).
- [ ] Probado el endpoint desde Swagger UI con el "Authorize" pegado.

## 11. Cómo lo verifica el revisor

```bash
docker compose up -d
# luego abrir en el navegador:
#   http://localhost:3001/api/docs   ← auth
#   http://localhost:3002/api/docs   ← products
#   http://localhost:4050/api/docs   ← gateway
```

1. Click en `POST /auth/register` → "Try it out" → enviar.
2. Click en `POST /auth/login` → copiar `accessToken` de la respuesta.
3. Click en "Authorize" (candado arriba a la derecha) → pegar token → "Authorize" → "Close".
4. Click en `POST /products` → "Try it out" → enviar → verificar 201.
5. Click en `GET /products` → "Try it out" → enviar → ver el producto creado.

> Este flujo debe poder ejecutarse end-to-end sin tocar Postman ni el código.
