import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@peaku/shared';

import type { Product } from '../../../domain/product.entity';

export class ProductResponseDto {
  @ApiProperty({ example: '65f1a2b3c4d5e6f7a8b9c0d1' })
  id!: string;

  @ApiProperty({ example: 'SOJA-2024-001' })
  sku!: string;

  @ApiProperty({ example: 'Soja Premium Cosecha 2024' })
  name!: string;

  @ApiPropertyOptional({ example: 'Lote A-7, certificación orgánica', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 480.5 })
  price!: number;

  @ApiProperty({ example: 1500 })
  stock!: number;

  @ApiProperty({ example: 'cereales', enum: PRODUCT_CATEGORIES })
  category!: ProductCategory;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-05-20T20:00:00.000Z', type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-20T20:00:00.000Z', type: String, format: 'date-time' })
  updatedAt!: string;

  static fromDomain(product: Product): ProductResponseDto {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}

export class PaginatedProductsResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
