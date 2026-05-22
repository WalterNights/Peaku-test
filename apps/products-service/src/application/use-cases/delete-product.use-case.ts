import { Inject, Injectable } from '@nestjs/common';

import { ProductNotFoundError } from '../../domain/errors';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/product.repository';

@Injectable()
export class DeleteProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(id: string): Promise<void> {
    const product = await this.products.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }

    // Soft delete: preserva trazabilidad para auditoría/SENASA.
    await this.products.update(product.softDelete());
  }
}
