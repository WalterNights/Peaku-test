import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthStore } from '../../features/auth/store/auth.store';

/**
 * Panel flotante de herramientas para desarrollo / evaluación.
 *
 * **Sólo se renderiza si `environment.production === false`.**
 * En el build de producción el `@if` falsy hace que el componente quede
 * eliminado por dead-code elimination de esbuild.
 *
 * Hoy expone un sólo control: cambiar el role del user logueado entre
 * `user` y `admin` sin tener que crear dos cuentas separadas. Pensado
 * para que el evaluador pueda probar la lista de productos desde ambos
 * roles con un solo flujo de login.
 *
 * Si el endpoint del backend (`POST /api/v1/auth/dev/switch-role`) no
 * está disponible (ej. NODE_ENV=production), la llamada va a fallar con
 * 404 y el banner de error del AuthStore lo muestra.
 */
@Component({
  selector: 'app-dev-tools-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isProduction && authStore.isAuthenticated()) {
      <!-- Backdrop táctil — visible solo cuando el panel está expandido en mobile;
           clickear afuera lo cierra. En desktop el panel es más chico, no tapa
           contenido, así que el backdrop no aparece. -->
      @if (!collapsed()) {
        <button
          type="button"
          (click)="collapsed.set(true)"
          aria-label="Cerrar panel de desarrollo"
          class="md:hidden fixed inset-0 z-[99] bg-foreground/20 backdrop-blur-[2px]"
        ></button>
      }
      <div class="fixed bottom-4 right-4 z-[100] font-body-sm text-body-sm">
        @if (collapsed()) {
          <button
            type="button"
            (click)="collapsed.set(false)"
            class="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center shadow-md hover:bg-foreground/90 transition-colors"
            aria-label="Abrir panel de desarrollo"
            title="Panel de desarrollo"
          >
            <span class="material-symbols-outlined text-[20px]">construction</span>
          </button>
        } @else {
          <div
            role="region"
            aria-label="Panel de desarrollo"
            class="w-72 bg-foreground text-background rounded-lg shadow-md border border-foreground/20"
          >
            <header class="flex items-center justify-between px-4 py-3 border-b border-background/10">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-accent">construction</span>
                <span class="font-semibold tracking-wide">DEV TOOLS</span>
              </div>
              <button
                type="button"
                (click)="collapsed.set(true)"
                aria-label="Cerrar panel"
                class="text-background/60 hover:text-background transition-colors"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </header>

            <div class="px-4 py-3 space-y-3">
              <p class="text-background/70 text-[12px] leading-snug">
                Solo visible en desarrollo. Permite cambiar el rol sin re-loguearse,
                para evaluar la app desde ambas perspectivas con un solo usuario.
              </p>

              <div class="flex items-center justify-between gap-2">
                <span class="text-background/70">Rol actual:</span>
                <span
                  class="px-2 py-0.5 rounded-[6px] text-[12px] font-semibold uppercase tracking-wider"
                  [class]="
                    currentRole() === 'admin'
                      ? 'bg-accent/20 text-accent'
                      : 'bg-background/10 text-background'
                  "
                >
                  {{ currentRole() }}
                </span>
              </div>

              <div class="flex gap-2 pt-1">
                <button
                  type="button"
                  (click)="switchTo('user')"
                  [disabled]="authStore.loading() || currentRole() === 'user'"
                  class="flex-1 h-9 rounded-lg border border-background/30 hover:bg-background/10 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  User
                </button>
                <button
                  type="button"
                  (click)="switchTo('admin')"
                  [disabled]="authStore.loading() || currentRole() === 'admin'"
                  class="flex-1 h-9 rounded-lg bg-accent text-foreground hover:bg-accent/90 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent"
                >
                  Admin
                </button>
              </div>

              @if (authStore.loading()) {
                <p class="text-background/70 text-[12px]">Cambiando rol…</p>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class DevToolsPanelComponent {
  readonly authStore = inject(AuthStore);

  readonly isProduction = environment.production;
  /** Arranca cerrado para no tapar contenido. El user lo abre cuando lo necesita. */
  readonly collapsed = signal(true);

  readonly currentRole = computed(() => this.authStore.user()?.role ?? 'user');

  async switchTo(role: 'user' | 'admin'): Promise<void> {
    if (this.currentRole() === role) return;
    await this.authStore.switchRole(role);
    // Si estamos en /products, la página se monta de nuevo cuando el user cambia
    // de role gracias al ChangeDetection signal-based (los botones admin se
    // habilitan/deshabilitan al toque). No es necesario navegar.
  }
}
