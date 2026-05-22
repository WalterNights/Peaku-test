import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

/**
 * Tipos definidos localmente para autonomía del frontend.
 * Refleja el shape del backend en libs/shared/src/types/product.types.ts.
 * Si el backend cambia el enum, hay que sincronizar acá manualmente.
 */
export type ProductCategory = 'cereales' | 'oleaginosas' | 'forrajeras' | 'otros';

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'cereales',
  'oleaginosas',
  'forrajeras',
  'otros',
];

/** Labels en español para mostrar en UI. */
export const PRODUCT_CATEGORY_LABELS: Readonly<Record<ProductCategory, string>> = {
  cereales: 'Cereales',
  oleaginosas: 'Oleaginosas',
  forrajeras: 'Forrajeras',
  otros: 'Otros',
};

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: ProductCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: ProductCategory;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  sku: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: ProductCategory;
  isActive?: boolean;
}

export type UpdateProductDto = Partial<Omit<CreateProductDto, 'sku'>>;

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/products`;

  list(params: ListProductsParams = {}): Observable<PaginatedProducts> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', String(params.page));
    if (params.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params.search && params.search.length > 0) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.category) httpParams = httpParams.set('category', params.category);
    return this.http.get<PaginatedProducts>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, dto);
  }

  update(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
