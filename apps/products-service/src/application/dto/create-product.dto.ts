import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@peaku/shared';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'SOJA-2024-001',
    minLength: 3,
    maxLength: 40,
    description: 'SKU único del producto (uppercase, alfanumérico + guiones).',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[A-Z0-9-]+$/i, { message: 'sku must contain only letters, numbers and dashes' })
  sku!: string;

  @ApiProperty({ example: 'Soja Premium Cosecha 2024', minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Lote A-7, certificación orgánica', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 480.5, minimum: 0.01, maximum: 1_000_000, description: 'Precio en USD.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  @Max(1_000_000)
  price!: number;

  @ApiProperty({ example: 1500, minimum: 0, description: 'Unidades disponibles (entero).' })
  @IsInt()
  @Type(() => Number)
  @Min(0)
  stock!: number;

  @ApiProperty({ example: 'cereales', enum: PRODUCT_CATEGORIES })
  @IsIn(PRODUCT_CATEGORIES)
  category!: ProductCategory;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
