import type { ProductCategory } from '@peaku/shared';

import type { Product } from './product.entity';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ListProductsCriteria {
  page: number;
  limit: number;
  category?: ProductCategory;
  search?: string;
  includeInactive?: boolean;
}

export interface ListProductsResult {
  items: Product[];
  total: number;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  list(criteria: ListProductsCriteria): Promise<ListProductsResult>;
  save(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
}
