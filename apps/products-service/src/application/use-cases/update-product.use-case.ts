import { Inject, Injectable } from '@nestjs/common';

import { ProductNotFoundError } from '../../domain/errors';
import type { Product } from '../../domain/product.entity';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/product.repository';
import type { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class UpdateProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }

    const updated = product.withUpdates({
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });

    return this.products.update(updated);
  }
}
