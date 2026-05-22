import { Inject, Injectable } from '@nestjs/common';
import { type Paginated } from '@peaku/shared';

import type { Product } from '../../domain/product.entity';
import { PRODUCT_REPOSITORY, type ProductRepository } from '../../domain/product.repository';
import type { ListProductsQueryDto } from '../dto/list-products.query.dto';

@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(query: ListProductsQueryDto, isAdmin: boolean): Promise<Paginated<Product>> {
    // Sólo admin puede pedir productos inactivos / soft-deleted.
    const includeInactive = isAdmin && (query.includeInactive ?? false);

    const { items, total } = await this.products.list({
      page: query.page,
      limit: query.limit,
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { search: query.search } : {}),
      includeInactive,
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
