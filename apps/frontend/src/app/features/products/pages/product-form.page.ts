import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../auth/store/auth.store';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type Product,
  type ProductCategory,
} from '../data/products.api';
import { ProductsStore } from '../store/products.store';

type FormMode = 'create' | 'edit';

/**
 * Form de crear / editar producto — basado en stitch-exports/product-form/screen.html.
 *
 * El componente determina el modo según la presencia del `:id` en la ruta:
 *  - `/products/new` → modo `create` (form vacío)
 *  - `/products/:id/edit` → modo `edit` (form hidratado con `store.getProduct(id)`)
 *
 * Validaciones espejo del backend (CreateProductDto):
 *  - sku: 3-40 chars, `[A-Z0-9-]+` (case-insensitive). Disabled en modo edit (immutable).
 *  - name: 3-120 chars.
 *  - description: opcional, max 500.
 *  - price: > 0, max 1.000.000, max 2 decimales.
 *  - stock: entero ≥ 0.
 *  - category: enum (cereales | oleaginosas | forrajeras | otros).
 *  - isActive: boolean (default true en create).
 *
 * Diferencias respecto al export Stitch:
 *  - Removidas las cards de Trazabilidad e Imagen del export — el backend
 *    no tiene esos campos en el modelo Product. Si se agregan más adelante,
 *    se suman acá.
 *  - El sidebar derecho mantiene sólo "Estado" (switch Activo).
 *  - El input SKU en modo edit aparece disabled con helper "no editable
 *    después de creado" (mismo design que el export).
 */
@Component({
  selector: 'app-product-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col bg-background">
      <!-- TopNavBar (reuso visual del products-list) -->
      <header class="sticky top-0 z-50 h-16 w-full bg-background/80 backdrop-blur border-b border-border">
        <div class="max-w-container-max mx-auto h-full flex justify-between items-center px-4 sm:px-6">
          <a [routerLink]="['/products']" class="flex items-center gap-1">
            <span class="font-h2 text-h2 text-primary font-bold">PeaKu</span>
            <span class="w-1.5 h-1.5 rounded-full bg-accent mt-1"></span>
          </a>
          <nav class="hidden md:flex items-center gap-8 font-body-sm text-body-sm font-medium">
            <a
              [routerLink]="['/products']"
              class="text-primary font-semibold border-b-2 border-primary pb-1"
            >
              Productos
            </a>
            <span class="text-muted-foreground/60 cursor-not-allowed" title="Próximamente">Pedidos</span>
            <span class="text-muted-foreground/60 cursor-not-allowed" title="Próximamente">Reportes</span>
            <a
              [href]="docsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-secondary hover:text-primary transition-colors inline-flex items-center gap-1"
              title="Abrir Swagger del API gateway en una nueva pestaña"
            >
              Documentación
              <span class="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </nav>
          <span class="hidden md:inline font-body-sm text-body-sm font-medium text-foreground">
            {{ userDisplayName() }}
          </span>
        </div>
      </header>

      <!-- Main -->
      <main class="flex-grow max-w-container-max mx-auto w-full pt-8 pb-32 px-4 sm:px-6">
        <!-- Breadcrumb -->
        <nav class="mb-6 font-body-sm text-body-sm">
          <a
            [routerLink]="['/products']"
            class="text-muted-foreground hover:underline underline-offset-4"
          >
            Productos
          </a>
          <span class="mx-2 text-muted-foreground">/</span>
          <span class="text-foreground font-medium">
            {{ mode() === 'create' ? 'Nuevo producto' : 'Editar producto' }}
          </span>
        </nav>

        <!-- Page Header -->
        <div class="mb-8">
          <p
            class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest mb-2"
          >
            {{ mode() === 'create' ? 'NUEVO PRODUCTO' : 'EDITAR PRODUCTO' }}
          </p>
          <h1 class="font-display-md text-display-md text-foreground mb-3">
            @if (mode() === 'edit' && original(); as p) {
              {{ p.name }}
            } @else {
              Nuevo producto
            }
          </h1>
          @if (mode() === 'edit' && original(); as p) {
            <p class="font-body-sm text-body-sm text-muted-foreground">
              <span class="font-mono text-mono">{{ p.sku }}</span>
              · creado el {{ formatDate(p.createdAt) }}
              · última edición {{ formatDate(p.updatedAt) }}
            </p>
          }
        </div>

        @if (loading() && !original() && mode() === 'edit') {
          <div class="text-center py-16 text-muted-foreground font-body">
            Cargando producto…
          </div>
        } @else {
          <!-- Banner de error global -->
          @if (error()) {
            <div
              role="alert"
              class="mb-6 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive font-body-sm text-body-sm"
            >
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Columna izquierda — Card principal -->
            <div class="lg:col-span-2 bg-card border border-border rounded-lg p-8 space-y-8">
              <!-- Sección 1: Información básica -->
              <section class="space-y-5">
                <p
                  class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest"
                >
                  INFORMACIÓN BÁSICA
                </p>

                <div class="space-y-1.5">
                  <label for="sku" class="block font-body-sm text-body-sm font-medium text-foreground">
                    SKU
                  </label>
                  <input
                    id="sku"
                    type="text"
                    formControlName="sku"
                    placeholder="SOJA-2026-001"
                    autocomplete="off"
                    class="w-full h-10 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-mono text-mono focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors disabled:bg-muted disabled:cursor-not-allowed aria-[invalid=true]:border-destructive"
                    [attr.aria-invalid]="fieldHasError('sku') ? true : null"
                  />
                  <p class="font-body-sm text-body-sm text-muted-foreground">
                    @if (mode() === 'edit') {
                      Identificador único interno. No editable después de creado.
                    } @else if (fieldHasError('sku')) {
                      <span class="text-destructive">3 a 40 caracteres. Sólo letras, números y guiones.</span>
                    } @else {
                      Identificador único. Mayúsculas, números y guiones (ej: SOJA-2026-001).
                    }
                  </p>
                </div>

                <div class="space-y-1.5">
                  <label for="name" class="block font-body-sm text-body-sm font-medium text-foreground">
                    Nombre del producto
                  </label>
                  <input
                    id="name"
                    type="text"
                    formControlName="name"
                    placeholder="Soja Premium Cosecha 2026"
                    autocomplete="off"
                    class="w-full h-10 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive"
                    [attr.aria-invalid]="fieldHasError('name') ? true : null"
                  />
                  @if (fieldHasError('name')) {
                    <p class="font-body-sm text-body-sm text-destructive">
                      3 a 120 caracteres.
                    </p>
                  }
                </div>

                <div class="space-y-1.5">
                  <label
                    for="description"
                    class="block font-body-sm text-body-sm font-medium text-foreground"
                  >
                    Descripción
                    <span class="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="description"
                    formControlName="description"
                    rows="4"
                    placeholder="Detalles del lote, certificaciones, condiciones de almacenamiento…"
                    class="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive"
                    [attr.aria-invalid]="fieldHasError('description') ? true : null"
                  ></textarea>
                  @if (fieldHasError('description')) {
                    <p class="font-body-sm text-body-sm text-destructive">Máximo 500 caracteres.</p>
                  }
                </div>
              </section>

              <hr class="border-t border-border" />

              <!-- Sección 2: Catalogación -->
              <section class="space-y-5">
                <p
                  class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest"
                >
                  CATALOGACIÓN
                </p>

                <div class="space-y-1.5 max-w-xs">
                  <label for="category" class="block font-body-sm text-body-sm font-medium text-foreground">
                    Categoría
                  </label>
                  <select
                    id="category"
                    formControlName="category"
                    class="w-full h-10 px-3 rounded-lg border border-border bg-card text-foreground font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive"
                    [attr.aria-invalid]="fieldHasError('category') ? true : null"
                  >
                    <option value="" disabled>Elegí una categoría</option>
                    @for (cat of categories; track cat) {
                      <option [value]="cat">{{ categoryLabels[cat] }}</option>
                    }
                  </select>
                  @if (fieldHasError('category')) {
                    <p class="font-body-sm text-body-sm text-destructive">Categoría requerida.</p>
                  }
                </div>
              </section>

              <hr class="border-t border-border" />

              <!-- Sección 3: Precio y stock -->
              <section class="space-y-5">
                <p
                  class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest"
                >
                  PRECIO Y STOCK
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <label for="price" class="block font-body-sm text-body-sm font-medium text-foreground">
                      Precio unitario
                    </label>
                    <div class="relative">
                      <span
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-body-sm text-body-sm pointer-events-none"
                      >
                        $
                      </span>
                      <input
                        id="price"
                        type="number"
                        formControlName="price"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        placeholder="0.00"
                        class="w-full h-10 pl-7 pr-3 py-2 rounded-lg border border-border bg-card text-foreground font-body tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive"
                        [attr.aria-invalid]="fieldHasError('price') ? true : null"
                      />
                    </div>
                    @if (fieldHasError('price')) {
                      <p class="font-body-sm text-body-sm text-destructive">
                        Mayor a 0 y hasta 1.000.000.
                      </p>
                    }
                  </div>

                  <div class="space-y-1.5">
                    <label for="stock" class="block font-body-sm text-body-sm font-medium text-foreground">
                      Stock disponible
                    </label>
                    <input
                      id="stock"
                      type="number"
                      formControlName="stock"
                      min="0"
                      step="1"
                      placeholder="0"
                      class="w-full h-10 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body tabular-nums focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive"
                      [attr.aria-invalid]="fieldHasError('stock') ? true : null"
                    />
                    @if (fieldHasError('stock')) {
                      <p class="font-body-sm text-body-sm text-destructive">
                        Número entero igual o mayor a 0.
                      </p>
                    }
                  </div>
                </div>
              </section>
            </div>

            <!-- Columna derecha — Sidebar de estado -->
            <aside class="lg:col-span-1 space-y-6">
              <div class="bg-card border border-border rounded-lg p-6 space-y-4">
                <p
                  class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest"
                >
                  ESTADO
                </p>

                <label
                  class="flex items-start justify-between gap-4 cursor-pointer"
                  for="isActive"
                >
                  <div class="flex-1">
                    <span class="block font-body-sm text-body-sm font-medium text-foreground">
                      Producto activo
                    </span>
                    <span class="block font-body-sm text-body-sm text-muted-foreground mt-1">
                      Visible en el catálogo. Si está inactivo, no se lista para compradores.
                    </span>
                  </div>
                  <input
                    id="isActive"
                    type="checkbox"
                    formControlName="isActive"
                    class="h-5 w-5 rounded-[6px] border-border text-primary-container focus:ring-accent bg-card mt-1 shrink-0"
                  />
                </label>
              </div>
            </aside>
          </form>
        }
      </main>

      <!-- Sticky footer con acciones -->
      <div
        class="sticky bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur"
      >
        <div
          class="max-w-container-max mx-auto px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <a
            [routerLink]="['/products']"
            class="h-10 px-5 rounded-lg text-foreground font-body-sm text-body-sm font-medium hover:bg-muted transition-colors flex items-center justify-center"
          >
            Cancelar
          </a>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="form.invalid || loading()"
            class="h-10 px-6 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary-container transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            @if (loading()) {
              Guardando…
            } @else {
              <span class="material-symbols-outlined text-[18px]">check</span>
              {{ mode() === 'create' ? 'Crear producto' : 'Guardar cambios' }}
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProductFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly authStore = inject(AuthStore);
  readonly store = inject(ProductsStore);

  readonly categories = PRODUCT_CATEGORIES;
  readonly categoryLabels = PRODUCT_CATEGORY_LABELS;
  /** Swagger consolidado del gateway (cubre auth + products). */
  readonly docsUrl = `${environment.apiBaseUrl}/api/docs`;

  readonly mode = signal<FormMode>('create');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly original = signal<Product | null>(null);

  readonly userDisplayName = computed(() => {
    const u = this.authStore.user();
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
  });

  readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40), Validators.pattern(/^[A-Z0-9-]+$/i)]],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    price: [0, [Validators.required, Validators.min(0.01), Validators.max(1_000_000)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    category: ['' as ProductCategory | '', [Validators.required]],
    isActive: [true],
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mode.set('edit');
      void this.loadProduct(id);
    } else {
      this.mode.set('create');
    }

    // Cleanup del error al destruir.
    this.destroyRef.onDestroy(() => this.error.set(null));
  }

  fieldHasError(name: 'sku' | 'name' | 'description' | 'price' | 'stock' | 'category'): boolean {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }

  private async loadProduct(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = await this.store.getProduct(id);
      this.original.set(p);
      this.form.patchValue({
        sku: p.sku,
        name: p.name,
        description: p.description ?? '',
        price: p.price,
        stock: p.stock,
        category: p.category,
        isActive: p.isActive,
      });
      // SKU es immutable en edit.
      this.form.controls.sku.disable({ emitEvent: false });
    } catch {
      this.error.set('No pudimos cargar el producto.');
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.loading.set(true);
    try {
      const v = this.form.getRawValue();
      if (this.mode() === 'create') {
        await this.store.createProduct({
          sku: v.sku.trim().toUpperCase(),
          name: v.name.trim(),
          ...(v.description ? { description: v.description.trim() } : {}),
          price: Number(v.price),
          stock: Number(v.stock),
          category: v.category as ProductCategory,
          isActive: v.isActive,
        });
      } else {
        const orig = this.original();
        if (!orig) return;
        await this.store.updateProduct(orig.id, {
          name: v.name.trim(),
          description: v.description ? v.description.trim() : undefined,
          price: Number(v.price),
          stock: Number(v.stock),
          category: v.category as ProductCategory,
          isActive: v.isActive,
        });
      }
      await this.router.navigate(['/products']);
    } catch {
      // El error ya quedó en store.error(), pero también lo mostramos local.
      this.error.set(this.store.error() ?? 'No pudimos guardar el producto.');
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
}
