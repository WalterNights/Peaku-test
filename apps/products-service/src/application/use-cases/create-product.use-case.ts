import { Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

import { DuplicateSkuError } from '../../domain/errors';
import { Product } from '../../domain/product.entity';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/product.repository';
import type { CreateProductDto } from '../dto/create-product.dto';

@Injectable()
export class CreateProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(dto: CreateProductDto): Promise<Product> {
    const normalizedSku = dto.sku.trim().toUpperCase();

    const existing = await this.products.findBySku(normalizedSku);
    if (existing) {
      throw new DuplicateSkuError(normalizedSku);
    }

    const product = Product.create({
      id: new Types.ObjectId().toHexString(),
      sku: normalizedSku,
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      stock: dto.stock,
      category: dto.category,
      isActive: dto.isActive ?? true,
    });

    return this.products.save(product);
  }
}
