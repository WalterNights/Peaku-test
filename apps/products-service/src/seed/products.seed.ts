/* eslint-disable no-console, import/first */
// Si corremos el seed desde la host machine (no dentro del container), usamos
// la URI a través de 127.0.0.1 en lugar del hostname de Docker (mongo-products).
if (process.env['MONGO_PRODUCTS_URI_LOCAL'] && !process.env['INSIDE_DOCKER']) {
  process.env['MONGO_URI'] = process.env['MONGO_PRODUCTS_URI_LOCAL'];
}

import { NestFactory } from '@nestjs/core';
import { type ProductCategory } from '@peaku/shared';

import { CreateProductUseCase } from '../application/use-cases/create-product.use-case';
import { AppModule } from '../app.module';
import { DuplicateSkuError } from '../domain/errors';

interface SeedProduct {
  sku: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: ProductCategory;
}

const DEMO_PRODUCTS: readonly SeedProduct[] = [
  {
    sku: 'SOJA-2026-001',
    name: 'Soja Premium Cosecha 2026',
    description: 'Lote A-7, certificación orgánica, origen Córdoba',
    price: 480.5,
    stock: 1500,
    category: 'oleaginosas',
  },
  {
    sku: 'MAIZ-2026-002',
    name: 'Maíz Pisingallo Cosecha 2026',
    description: 'Apto para industria del popcorn, calidad export',
    price: 240.0,
    stock: 3200,
    category: 'cereales',
  },
  {
    sku: 'TRIGO-2026-003',
    name: 'Trigo Pan PH78',
    description: 'Trigo pan calidad molinería, gluten húmedo > 27%',
    price: 210.75,
    stock: 2800,
    category: 'cereales',
  },
  {
    sku: 'GIRASOL-2026-004',
    name: 'Girasol Alto Oleico',
    description: 'Variedad alto oleico, 80% ácido oleico mínimo',
    price: 520.0,
    stock: 800,
    category: 'oleaginosas',
  },
  {
    sku: 'CEBADA-2026-005',
    name: 'Cebada Cervecera Scarlett',
    description: 'Calidad maltera, proteína 11-12%',
    price: 195.0,
    stock: 1200,
    category: 'cereales',
  },
  {
    sku: 'SORGO-2026-006',
    name: 'Sorgo Granífero Bajo Tanino',
    description: 'Apto consumo animal y exportación',
    price: 175.5,
    stock: 1800,
    category: 'cereales',
  },
  {
    sku: 'ALFALFA-2026-007',
    name: 'Alfalfa Fardo 16kg',
    description: 'Calidad premium para ganado lechero, primer corte',
    price: 12.5,
    stock: 5000,
    category: 'forrajeras',
  },
  {
    sku: 'AVENA-2026-008',
    name: 'Avena Forrajera',
    description: 'Verdeo de invierno, ideal para pastoreo directo',
    price: 165.0,
    stock: 950,
    category: 'cereales',
  },
  {
    sku: 'COLZA-2026-009',
    name: 'Colza Invernal',
    description: 'Híbrido tolerante a herbicidas, doble propósito',
    price: 565.0,
    stock: 600,
    category: 'oleaginosas',
  },
  {
    sku: 'MOHA-2026-010',
    name: 'Moha de Hungría',
    description: 'Forraje de verano, alto rendimiento de materia seca',
    price: 145.0,
    stock: 1400,
    category: 'forrajeras',
  },
];

async function seedProducts(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const createProduct = app.get(CreateProductUseCase);

  let created = 0;
  let skipped = 0;

  try {
    for (const dto of DEMO_PRODUCTS) {
      try {
        await createProduct.execute(dto);
        created++;
        console.log(`[seed] ✓ ${dto.sku} — ${dto.name}`);
      } catch (err) {
        if (err instanceof DuplicateSkuError) {
          skipped++;
          continue;
        }
        throw err;
      }
    }
    console.log(`[seed] Done. Created: ${created}, already existed: ${skipped}`);
  } finally {
    await app.close();
  }
}

seedProducts().catch((err: unknown) => {
  console.error('[seed] Failed to seed products:', err);
  process.exit(1);
});
