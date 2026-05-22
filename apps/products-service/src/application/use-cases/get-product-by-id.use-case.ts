import { Inject, Injectable } from '@nestjs/common';

import { ProductNotFoundError } from '../../domain/errors';
import type { Product } from '../../domain/product.entity';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/product.repository';

@Injectable()
export class GetProductByIdUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }
}
