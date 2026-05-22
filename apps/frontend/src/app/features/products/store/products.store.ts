import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import {
  Product,
  ProductCategory,
  ProductsApi,
  type CreateProductDto,
  type UpdateProductDto,
} from '../data/products.api';

interface ProductFilters {
  search: string;
  category: ProductCategory | null;
}

interface ProductsState {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  filters: ProductFilters;
  loading: boolean;
  error: string | null;
}

const PAGE_SIZE = 10;

const initialState: ProductsState = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  filters: { search: '', category: null },
  loading: false,
  error: null,
};

/**
 * Estado del catálogo de productos. Cumple el requisito "State Management" del Ej. 2.
 *
 * Responsabilidades:
 *  - Cargar página actual aplicando filtros (search + categoría).
 *  - Manejar paginación (setPage).
 *  - Aplicar/actualizar filtros (setSearch debe llamarse ya debouncado desde el componente).
 *  - Eliminar producto y refrescar la lista.
 *
 * Lo que NO está acá (fuera del alcance de esta iteración):
 *  - Cache por página / optimistic updates.
 *  - URL sync (search/category/page en query params del router).
 *  - Sort multi-columna (el backend no lo expone).
 */
export const ProductsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ items, total, page, limit }) => ({
    totalPages: computed(() => Math.max(1, Math.ceil(total() / limit()))),
    isEmpty: computed(() => items().length === 0),
    /** "Mostrando 1" — primer índice (1-based) de la página actual. 0 si no hay items. */
    rangeStart: computed(() => (items().length === 0 ? 0 : (page() - 1) * limit() + 1)),
    /** "10" — último índice (1-based) de la página actual. */
    rangeEnd: computed(() => Math.min(page() * limit(), total())),
  })),
  withMethods((store) => {
    const api = inject(ProductsApi);

    async function fetchPage(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const { search, category } = store.filters();
        const result = await firstValueFrom(
          api.list({
            page: store.page(),
            limit: store.limit(),
            ...(search ? { search } : {}),
            ...(category ? { category } : {}),
          }),
        );
        patchState(store, {
          items: result.items,
          total: result.total,
          page: result.page,
          limit: result.limit,
          loading: false,
        });
      } catch (err) {
        patchState(store, {
          error: parseProductsError(err),
          loading: false,
          items: [],
          total: 0,
        });
      }
    }

    return {
      loadPage(): Promise<void> {
        return fetchPage();
      },

      setSearch(search: string): Promise<void> {
        patchState(store, {
          filters: { ...store.filters(), search: search.trim() },
          page: 1,
        });
        return fetchPage();
      },

      setCategory(category: ProductCategory | null): Promise<void> {
        patchState(store, {
          filters: { ...store.filters(), category },
          page: 1,
        });
        return fetchPage();
      },

      clearFilters(): Promise<void> {
        patchState(store, {
          filters: { search: '', category: null },
          page: 1,
        });
        return fetchPage();
      },

      setPage(page: number): Promise<void> {
        const clamped = Math.max(1, Math.min(page, store.totalPages()));
        if (clamped === store.page()) return Promise.resolve();
        patchState(store, { page: clamped });
        return fetchPage();
      },

      async deleteProduct(id: string): Promise<void> {
        try {
          await firstValueFrom(api.delete(id));
          // Si era el último item de la última página, retroceder una página.
          if (store.items().length === 1 && store.page() > 1) {
            patchState(store, { page: store.page() - 1 });
          }
          await fetchPage();
        } catch (err) {
          patchState(store, { error: parseProductsError(err) });
          throw err;
        }
      },

      /**
       * Crea un producto. Retorna el producto creado para que el caller
       * pueda navegar o mostrar confirmación. Re-fetch de la página actual
       * para mantener el state consistente (paginación, totales).
       */
      async createProduct(dto: CreateProductDto): Promise<Product> {
        try {
          const created = await firstValueFrom(api.create(dto));
          await fetchPage();
          return created;
        } catch (err) {
          patchState(store, { error: parseProductsError(err) });
          throw err;
        }
      },

      /**
       * Actualiza un producto existente. Retorna el producto actualizado.
       */
      async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
        try {
          const updated = await firstValueFrom(api.update(id, dto));
          await fetchPage();
          return updated;
        } catch (err) {
          patchState(store, { error: parseProductsError(err) });
          throw err;
        }
      },

      /**
       * Get one product by ID. Usado por ProductFormPage en modo editar
       * para hidratar el form. NO toca el state del store (es un read puntual).
       */
      getProduct(id: string): Promise<Product> {
        return firstValueFrom(api.getById(id));
      },

      clearError(): void {
        patchState(store, { error: null });
      },

      /**
       * Resetea el store al state inicial.
       * Lo llama el componente al destruirse — evita que datos viejos queden
       * cacheados entre login/logout (porque el store es providedIn: 'root').
       */
      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);

function parseProductsError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 401) return 'Tu sesión expiró. Iniciá sesión de nuevo.';
    if (err.status === 403) return 'No tenés permisos para esta acción.';
    if (err.status === 404) return 'El producto no existe o ya fue eliminado.';
    if (err.status === 409) return 'Conflicto: ese SKU ya existe.';
    if (err.status === 429) return 'Demasiadas solicitudes. Esperá un momento.';
    if (err.status === 0) return 'No pudimos conectar con el servidor.';
    if (err.status >= 500) return 'Algo salió mal en el servidor. Intentá más tarde.';
  }
  return 'No pudimos cargar los productos.';
}
