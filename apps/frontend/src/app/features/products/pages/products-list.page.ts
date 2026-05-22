import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../auth/store/auth.store';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import type { Product } from '../data/products.api';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from '../data/products.api';
import { ProductsStore } from '../store/products.store';

/**
 * Lista de productos — implementación fiel al export Stitch
 * (apps/frontend/stitch-exports/products-list/screen.html).
 *
 * Diferencias respecto al export:
 *  - Tabla bindeada al `ProductsStore` (NgRx Signal Store) en lugar de filas estáticas.
 *  - Filtros: search con debounce 300ms + select de categoría.
 *  - El select de "Estado" del export está omitido — el backend sólo expone
 *    `includeInactive` para admins; users normales sólo ven activos.
 *  - Paginador custom (Anterior/1/2.../N/Siguiente) con elipsis cuando hay >7 páginas.
 *  - User menu real: avatar con iniciales del user logueado + dropdown "Cerrar sesión".
 *  - Loading skeleton + empty state.
 *  - Categorías reales del backend (`cereales | oleaginosas | forrajeras | otros`),
 *    no las de fantasía del mock Stitch.
 *
 * Pendiente (próxima iteración):
 *  - Acciones de fila (edit/delete) — botones presentes pero `disabled`; el wire-up
 *    con MatDialog (confirm) y el form de editar/crear vienen después.
 *  - Vista de cards en mobile (el plan original lo prevé en Etapa 5).
 */
@Component({
  selector: 'app-products-list-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col bg-background">
      <!-- TopNavBar -->
      <header class="sticky top-0 z-50 h-16 w-full bg-background/80 backdrop-blur border-b border-border">
        <div
          class="max-w-container-max mx-auto h-full flex justify-between items-center px-4 sm:px-6"
        >
          <!-- Brand -->
          <div class="flex items-center gap-1">
            <span class="font-h2 text-h2 text-primary font-bold">PeaKu</span>
            <span class="w-1.5 h-1.5 rounded-full bg-accent mt-1"></span>
          </div>

          <!-- Navigation — "Productos" navega a /products (re-mounta la página).
               "Documentación" abre el Swagger del gateway en nueva pestaña.
               Pedidos/Reportes están deshabilitados porque sus features no están
               en alcance de la prueba. -->
          <nav class="hidden md:flex items-center gap-8 font-body-sm text-body-sm font-medium">
            <a
              [routerLink]="['/products']"
              aria-current="page"
              class="text-primary font-semibold border-b-2 border-primary pb-1 hover:text-primary-container transition-colors"
            >
              Productos
            </a>
            <span class="text-muted-foreground/60 cursor-not-allowed" title="Próximamente">
              Pedidos
            </span>
            <span class="text-muted-foreground/60 cursor-not-allowed" title="Próximamente">
              Reportes
            </span>
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

          <!-- User Menu -->
          <div class="relative">
            <button
              type="button"
              (click)="toggleUserMenu()"
              [attr.aria-expanded]="userMenuOpen()"
              class="flex items-center gap-3 group focus:outline-none"
            >
              <span class="hidden md:inline font-body-sm text-body-sm font-medium text-foreground">
                {{ userDisplayName() }}
              </span>
              <span
                class="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-body-sm text-body-sm font-semibold"
              >
                {{ initials() }}
              </span>
              <span
                class="material-symbols-outlined text-muted-foreground text-[20px] group-hover:text-foreground transition-colors"
              >
                expand_more
              </span>
            </button>

            @if (userMenuOpen()) {
              <div
                role="menu"
                class="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-md py-2"
              >
                <div class="px-4 py-2 border-b border-border">
                  <p class="font-body-sm text-body-sm font-medium text-foreground truncate">
                    {{ userDisplayName() }}
                  </p>
                  <p class="font-body-sm text-body-sm text-muted-foreground truncate">
                    {{ authStore.user()?.email }}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  (click)="logout()"
                  class="w-full text-left px-4 py-2 font-body-sm text-body-sm text-foreground hover:bg-muted transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-grow max-w-container-max mx-auto w-full py-12 px-4 sm:px-6">
        <!-- Page Header -->
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
          <div class="max-w-2xl">
            <p
              class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest mb-2"
            >
              CATÁLOGO
            </p>
            <h1 class="font-display-md text-display-md text-foreground mb-3">Mis productos</h1>
            <p class="font-body text-body text-muted-foreground">
              Gestioná tu inventario agropecuario. SKUs trazables, precios actualizables, control
              de stock.
            </p>
          </div>
          <div class="w-full md:w-auto md:shrink-0 mt-2 md:mt-0">
            @if (isAdmin()) {
              <a
                [routerLink]="['/products', 'new']"
                class="h-11 md:h-10 px-4 bg-primary text-on-primary rounded-lg font-body-sm text-body-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
                Nuevo producto
              </a>
            } @else {
              <button
                type="button"
                disabled
                title="Sólo administradores pueden crear productos"
                class="w-full h-11 md:h-10 px-4 bg-primary text-on-primary rounded-lg font-body-sm text-body-sm font-semibold flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
                Nuevo producto
              </button>
            }
          </div>
        </div>

        <!-- Filter Toolbar — responsive:
             - mobile: search full-width + chips horizontales scrolleables
             - desktop: search + select de categoría inline + "Limpiar filtros" derecha -->
        <div class="flex flex-col gap-3 mb-6">
          <div class="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div class="relative md:max-w-md w-full">
              <span
                class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[18px] pointer-events-none"
              >
                search
              </span>
              <input
                type="text"
                [formControl]="searchControl"
                placeholder="Buscar por SKU o nombre…"
                class="w-full h-11 md:h-10 pl-9 pr-3 rounded-lg border border-border bg-card font-body-sm text-body-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
            <!-- Select de categoría: visible solo desktop -->
            <select
              [formControl]="categoryControl"
              class="hidden md:block md:w-48 h-10 px-3 rounded-lg border border-border bg-card font-body-sm text-body-sm text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            >
              <option value="">Todas las categorías</option>
              @for (cat of categories; track cat) {
                <option [value]="cat">{{ categoryLabels[cat] }}</option>
              }
            </select>
            @if (hasFilters()) {
              <button
                type="button"
                (click)="clearFilters()"
                class="hidden md:inline-flex md:ml-auto self-start md:self-center font-body-sm text-body-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpiar filtros
              </button>
            }
          </div>
          <!-- Chips de categoría horizontales: visible solo en mobile -->
          <div class="md:hidden flex overflow-x-auto gap-2 pb-1 -mx-4 px-4 hide-scrollbar">
            <button
              type="button"
              (click)="categoryControl.setValue('')"
              [class]="
                !categoryControl.value
                  ? 'shrink-0 h-9 px-3 rounded-full bg-primary-container text-on-primary font-body-sm text-xs font-medium border border-transparent'
                  : 'shrink-0 h-9 px-3 rounded-full bg-transparent text-foreground border border-border font-body-sm text-xs font-medium hover:bg-muted transition-colors'
              "
            >
              Todas
            </button>
            @for (cat of categories; track cat) {
              <button
                type="button"
                (click)="categoryControl.setValue(cat)"
                [class]="
                  categoryControl.value === cat
                    ? 'shrink-0 h-9 px-3 rounded-full bg-primary-container text-on-primary font-body-sm text-xs font-medium border border-transparent'
                    : 'shrink-0 h-9 px-3 rounded-full bg-transparent text-foreground border border-border font-body-sm text-xs font-medium hover:bg-muted transition-colors'
                "
              >
                {{ categoryLabels[cat] }}
              </button>
            }
            @if (hasFilters()) {
              <button
                type="button"
                (click)="clearFilters()"
                class="shrink-0 h-9 px-3 font-body-sm text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Limpiar
              </button>
            }
          </div>
        </div>

        <!-- Error banner -->
        @if (store.error()) {
          <div
            role="alert"
            class="mb-4 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive font-body-sm text-body-sm flex items-center justify-between"
          >
            <span>{{ store.error() }}</span>
            <button
              type="button"
              (click)="store.clearError()"
              aria-label="Cerrar"
              class="text-destructive/70 hover:text-destructive ml-3"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        }

        <!-- Products Table Card — visible solo en desktop (md+) -->
        <div class="hidden md:block bg-card rounded-lg border border-border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-muted/50 border-b border-border">
                <tr>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold">
                    SKU
                  </th>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold">
                    Producto
                  </th>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold">
                    Categoría
                  </th>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold text-right">
                    Precio
                  </th>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold text-right">
                    Stock
                  </th>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold text-center">
                    Estado
                  </th>
                  <th class="py-3 px-4 font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody
                class="divide-y divide-border font-body-sm text-body-sm text-foreground"
                [class.opacity-60]="store.loading()"
              >
                @if (store.loading() && store.items().length === 0) {
                  @for (i of skeletonRows; track i) {
                    <tr>
                      <td class="py-3 px-4" colspan="7">
                        <div class="h-4 w-full bg-muted/60 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  }
                } @else if (store.isEmpty() && !store.loading()) {
                  <tr>
                    <td colspan="7" class="py-16 px-4 text-center">
                      <div class="flex flex-col items-center gap-3">
                        <span class="material-symbols-outlined text-[40px] text-muted-foreground">
                          inventory_2
                        </span>
                        <p class="font-body text-body text-muted-foreground">
                          @if (hasFilters()) {
                            No encontramos productos con esos filtros.
                          } @else {
                            Todavía no hay productos en el catálogo.
                          }
                        </p>
                        @if (hasFilters()) {
                          <button
                            type="button"
                            (click)="clearFilters()"
                            class="font-body-sm text-body-sm text-accent hover:underline underline-offset-4"
                          >
                            Limpiar filtros
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @else {
                  @for (p of store.items(); track p.id) {
                    <tr class="hover:bg-muted/30 transition-colors">
                      <td class="py-3 px-4 whitespace-nowrap">
                        <span class="font-mono text-mono">{{ p.sku }}</span>
                      </td>
                      <td class="py-3 px-4 font-medium" [class.text-muted-foreground]="!p.isActive">
                        {{ p.name }}
                      </td>
                      <td class="py-3 px-4">
                        <span
                          class="bg-muted px-2 py-0.5 rounded-[6px] text-[12px] font-medium text-secondary"
                        >
                          {{ categoryLabels[p.category] }}
                        </span>
                      </td>
                      <td
                        class="py-3 px-4 text-right tabular-nums"
                        [class.text-muted-foreground]="!p.isActive"
                      >
                        {{ formatPrice(p.price) }}
                      </td>
                      <td
                        class="py-3 px-4 text-right tabular-nums"
                        [class.text-muted-foreground]="p.stock === 0 || !p.isActive"
                      >
                        {{ p.stock.toLocaleString('es-AR') }}
                      </td>
                      <td class="py-3 px-4 text-center">
                        @switch (statusOf(p)) {
                          @case ('inactive') {
                            <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-medium bg-muted text-muted-foreground">
                              Inactivo
                            </span>
                          }
                          @case ('out') {
                            <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-medium bg-destructive/10 text-destructive">
                              Sin stock
                            </span>
                          }
                          @case ('low') {
                            <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-medium bg-accent/15 text-foreground">
                              Bajo stock
                            </span>
                          }
                          @default {
                            <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-medium bg-primary/10 text-primary">
                              Activo
                            </span>
                          }
                        }
                      </td>
                      <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-2 text-secondary">
                          @if (isAdmin()) {
                            <a
                              [routerLink]="['/products', p.id, 'edit']"
                              title="Editar"
                              aria-label="Editar producto"
                              class="hover:text-primary transition-colors inline-flex"
                            >
                              <span class="material-symbols-outlined text-[18px]">edit</span>
                            </a>
                            <button
                              type="button"
                              (click)="openDeleteConfirm(p)"
                              title="Eliminar"
                              aria-label="Eliminar producto"
                              class="hover:text-destructive transition-colors"
                            >
                              <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          } @else {
                            <button
                              type="button"
                              disabled
                              title="Sólo administradores"
                              class="opacity-40 cursor-not-allowed"
                            >
                              <span class="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              disabled
                              title="Sólo administradores"
                              class="opacity-40 cursor-not-allowed"
                            >
                              <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (!store.isEmpty()) {
            <div
              class="px-4 py-3 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <span class="font-body-sm text-body-sm text-muted-foreground tabular-nums">
                Mostrando {{ store.rangeStart() }}–{{ store.rangeEnd() }} de
                {{ store.total() }}
                {{ store.total() === 1 ? 'producto' : 'productos' }}
              </span>
              @if (store.totalPages() > 1) {
                <nav aria-label="Paginación" class="flex items-center gap-1">
                  <button
                    type="button"
                    (click)="store.setPage(store.page() - 1)"
                    [disabled]="store.page() === 1"
                    class="h-8 px-3 text-[13px] font-medium rounded border border-border text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    Anterior
                  </button>
                  @for (slot of visiblePages(); track $index) {
                    @if (slot === 'ellipsis') {
                      <span class="text-muted-foreground px-1 text-[13px]">…</span>
                    } @else {
                      <button
                        type="button"
                        (click)="store.setPage(slot)"
                        [attr.aria-current]="slot === store.page() ? 'page' : null"
                        [class]="
                          slot === store.page()
                            ? 'h-8 w-8 text-[13px] font-medium rounded border border-primary bg-primary text-on-primary flex items-center justify-center'
                            : 'h-8 w-8 text-[13px] font-medium rounded border border-transparent hover:border-border text-secondary hover:bg-muted/50 flex items-center justify-center transition-colors'
                        "
                      >
                        {{ slot }}
                      </button>
                    }
                  }
                  <button
                    type="button"
                    (click)="store.setPage(store.page() + 1)"
                    [disabled]="store.page() === store.totalPages()"
                    class="h-8 px-3 text-[13px] font-medium rounded border border-border text-foreground hover:bg-muted/50 transition-colors ml-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    Siguiente
                  </button>
                </nav>
              }
            </div>
          }
        </div>

        <!-- ============================================================
             MOBILE VIEW — cards en lugar de tabla (visible sólo < md)
             Basado en stitch-exports/products-list-mobile/screen.html
             ============================================================ -->
        <div class="md:hidden">
          @if (store.loading() && store.items().length === 0) {
            <div class="flex flex-col gap-3">
              @for (i of skeletonRows; track i) {
                <div class="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div class="h-3 w-24 bg-muted/60 rounded animate-pulse"></div>
                  <div class="h-4 w-full bg-muted/60 rounded animate-pulse"></div>
                  <div class="h-3 w-3/4 bg-muted/60 rounded animate-pulse"></div>
                </div>
              }
            </div>
          } @else if (store.isEmpty() && !store.loading()) {
            <div class="bg-card border border-border rounded-lg py-12 px-4 text-center">
              <div class="flex flex-col items-center gap-3">
                <span class="material-symbols-outlined text-[40px] text-muted-foreground">
                  inventory_2
                </span>
                <p class="font-body text-body text-muted-foreground">
                  @if (hasFilters()) {
                    No encontramos productos con esos filtros.
                  } @else {
                    Todavía no hay productos en el catálogo.
                  }
                </p>
                @if (hasFilters()) {
                  <button
                    type="button"
                    (click)="clearFilters()"
                    class="font-body-sm text-body-sm text-accent hover:underline underline-offset-4"
                  >
                    Limpiar filtros
                  </button>
                }
              </div>
            </div>
          } @else {
            <div class="flex flex-col gap-3" [class.opacity-60]="store.loading()">
              @for (p of store.items(); track p.id) {
                <article class="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                  <header class="flex justify-between items-start gap-3">
                    <span class="font-mono text-[11px] text-muted-foreground tracking-tight whitespace-nowrap">
                      {{ p.sku }}
                    </span>
                    @switch (statusOf(p)) {
                      @case ('inactive') {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-muted text-muted-foreground">
                          Inactivo
                        </span>
                      }
                      @case ('out') {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-destructive/10 text-destructive">
                          Sin stock
                        </span>
                      }
                      @case ('low') {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-accent/15 text-foreground">
                          Bajo stock
                        </span>
                      }
                      @default {
                        <span class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-primary/10 text-primary">
                          Activo
                        </span>
                      }
                    }
                  </header>

                  <h3
                    class="font-body text-base font-medium text-foreground leading-tight line-clamp-2"
                    [class.text-muted-foreground]="!p.isActive"
                  >
                    {{ p.name }}
                  </h3>

                  <div>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-muted text-foreground"
                    >
                      {{ categoryLabels[p.category] }}
                    </span>
                  </div>

                  <div class="flex justify-between items-center pt-1">
                    <span
                      class="font-body text-[15px] font-semibold text-foreground tabular-nums"
                      [class.text-muted-foreground]="!p.isActive"
                    >
                      {{ formatPrice(p.price) }}
                    </span>
                    <span
                      class="font-body-sm text-[12px] text-muted-foreground tabular-nums"
                    >
                      Stock: {{ p.stock.toLocaleString('es-AR') }}
                    </span>
                  </div>

                  <div class="flex justify-end gap-1 border-t border-border/50 pt-3 mt-1">
                    @if (isAdmin()) {
                      <a
                        [routerLink]="['/products', p.id, 'edit']"
                        aria-label="Editar producto"
                        class="h-9 w-9 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                      </a>
                      <button
                        type="button"
                        (click)="openDeleteConfirm(p)"
                        aria-label="Eliminar producto"
                        class="h-9 w-9 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    } @else {
                      <button
                        type="button"
                        disabled
                        title="Sólo administradores"
                        class="h-9 w-9 flex items-center justify-center rounded text-muted-foreground opacity-40 cursor-not-allowed"
                      >
                        <span class="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Sólo administradores"
                        class="h-9 w-9 flex items-center justify-center rounded text-muted-foreground opacity-40 cursor-not-allowed"
                      >
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    }
                  </div>
                </article>
              }
            </div>

            <!-- Paginación mobile — simplificada (Anterior/Siguiente sin números) -->
            @if (store.totalPages() > 1) {
              <div class="mt-6 flex flex-col items-center gap-3">
                <span class="font-body-sm text-[11px] text-muted-foreground tabular-nums">
                  Página {{ store.page() }} de {{ store.totalPages() }} ·
                  {{ store.total() }}
                  {{ store.total() === 1 ? 'producto' : 'productos' }}
                </span>
                <nav aria-label="Paginación" class="w-full flex gap-2">
                  <button
                    type="button"
                    (click)="store.setPage(store.page() - 1)"
                    [disabled]="store.page() === 1"
                    class="flex-1 h-10 rounded-lg border border-border text-foreground font-body-sm text-body-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    (click)="store.setPage(store.page() + 1)"
                    [disabled]="store.page() === store.totalPages()"
                    class="flex-1 h-10 rounded-lg border border-border text-foreground font-body-sm text-body-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    Siguiente →
                  </button>
                </nav>
              </div>
            } @else if (!store.isEmpty()) {
              <p
                class="mt-4 text-center font-body-sm text-[11px] text-muted-foreground tabular-nums"
              >
                {{ store.total() }}
                {{ store.total() === 1 ? 'producto' : 'productos' }}
              </p>
            }
          }
        </div>
      </main>
    </div>
  `,
})
export class ProductsListPage implements OnInit {
  readonly authStore = inject(AuthStore);
  readonly store = inject(ProductsStore);
  private readonly dialog = inject(MatDialog);

  // inject() debe llamarse en un field initializer o en el constructor,
  // NUNCA dentro de ngOnInit (tirar NG0203).
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = PRODUCT_CATEGORIES;
  readonly categoryLabels = PRODUCT_CATEGORY_LABELS;
  readonly skeletonRows = [0, 1, 2, 3, 4];
  /** Swagger consolidado del gateway (cubre auth + products). */
  readonly docsUrl = `${environment.apiBaseUrl}/api/docs`;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly categoryControl = new FormControl<ProductCategory | ''>('', { nonNullable: true });

  readonly userMenuOpen = signal(false);

  readonly hasFilters = computed(
    () => !!this.searchControl.value || !!this.categoryControl.value,
  );

  readonly initials = computed(() => {
    const u = this.authStore.user();
    if (!u) return '?';
    const first = u.firstName?.[0] ?? u.email[0] ?? '?';
    const last = u.lastName?.[0] ?? '';
    return (first + last).toUpperCase();
  });

  readonly userDisplayName = computed(() => {
    const u = this.authStore.user();
    if (!u) return '';
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return fullName || u.email;
  });

  readonly isAdmin = computed(() => this.authStore.user()?.role === 'admin');

  /** Páginas visibles en el paginador, con elipsis cuando son >7 páginas. */
  readonly visiblePages = computed<readonly (number | 'ellipsis')[]>(() => {
    const total = this.store.totalPages();
    const current = this.store.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const slots: (number | 'ellipsis')[] = [1];
    if (current > 3) slots.push('ellipsis');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) slots.push(i);
    if (current < total - 2) slots.push('ellipsis');
    slots.push(total);
    return slots;
  });

  ngOnInit(): void {
    // Disparamos la carga inicial acá (NO en un onInit del store) porque
    // ProductsStore es providedIn: 'root' y persiste entre navegaciones.
    // Si el load lo dispara el componente, refresca cada vez que entrás a la ruta.
    void this.store.loadPage();

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => void this.store.setSearch(value));

    this.categoryControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => void this.store.setCategory(value || null));

    // Resetear el store al destruir el componente — evita que items/error/filtros
    // viejos queden persistidos cuando el user navega afuera y vuelve.
    this.destroyRef.onDestroy(() => this.store.reset());
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.authStore.logout();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.categoryControl.setValue('', { emitEvent: false });
    void this.store.clearFilters();
  }

  statusOf(p: { isActive: boolean; stock: number }): 'inactive' | 'out' | 'low' | 'active' {
    if (!p.isActive) return 'inactive';
    if (p.stock === 0) return 'out';
    if (p.stock < 50) return 'low';
    return 'active';
  }

  formatPrice(value: number): string {
    return `$ ${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  async openDeleteConfirm(p: Product): Promise<void> {
    const data: ConfirmDialogData = {
      title: 'Eliminar producto',
      message: `¿Estás seguro de que querés eliminar "${p.name}" (${p.sku})? El producto se marcará como eliminado pero se conserva la trazabilidad histórica.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    };
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data, autoFocus: 'first-tabbable', restoreFocus: true, panelClass: 'peaku-dialog' },
    );
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.store.deleteProduct(p.id);
    } catch {
      // El error ya quedó en store.error() y se muestra arriba del card.
    }
  }
}
