import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthStore } from '../store/auth.store';

/**
 * Login page — fiel al export de Stitch (apps/frontend/stitch-exports/login/)
 * con Reactive Form tipado y wire-up al AuthStore.
 *
 * Diferencias respecto al export:
 *  - Form reactivo con validaciones (email, min 8).
 *  - Toggle de visibility del password via signal.
 *  - Llamada al AuthStore.login al submit. El store maneja tokens, navegación y errores.
 *  - Banner verde si la URL trae ?registered=1 (viene del flujo Register OK).
 *  - Banner rojo del store si hay error de login (401, 429, 500, network).
 *  - Botón "Continuar con Google" disabled con tooltip — OAuth está fuera del alcance
 *    de la prueba (ver Ej. 5 teórico: OAuth vs JWT).
 *  - Link "¿Crear cuenta?" usa routerLink hacia /register.
 *  - Link "¿Olvidaste tu contraseña?" sigue en # (fuera de alcance).
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Mobile hero (arriba) — visible solo en mobile.
           El layout split queda intacto para desktop. -->
      <div class="md:hidden relative h-48 w-full">
        <div
          class="absolute inset-0 bg-cover bg-center"
          style="background-image: url('/assets/login-field.jpg');"
        ></div>
        <!-- Gradient suave desde abajo hacia arriba: hace transición a la sección form. -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"
        ></div>
        <!-- Wordmark sobre la imagen -->
        <h1
          class="absolute top-6 left-6 font-h2 text-h2 flex items-baseline gap-1 text-primary drop-shadow-sm"
        >
          PeaKu
          <span class="w-2 h-2 rounded-full bg-accent inline-block"></span>
        </h1>
      </div>

      <!-- Left Column (60%) — en mobile ocupa todo el ancho debajo del hero -->
      <div
        class="w-full md:w-[60%] md:min-h-screen flex flex-col justify-between p-6 md:p-8 lg:p-12 relative z-10"
      >
        <!-- Header desktop — oculto en mobile porque ya está sobre el hero -->
        <header class="hidden md:flex w-full items-center">
          <h1 class="font-h2 text-h2 flex items-baseline gap-1 text-primary">
            PeaKu
            <span class="w-2 h-2 rounded-full bg-accent inline-block"></span>
          </h1>
        </header>

        <!-- Centered Content -->
        <main
          class="w-full max-w-form-column mx-auto flex-grow flex flex-col justify-center py-12"
        >
          <div class="space-y-6">
            <!-- Headings -->
            <div class="space-y-2">
              <span
                class="font-label-eyebrow text-label-eyebrow uppercase tracking-widest text-muted-foreground block"
              >
                CUENTA INSTITUCIONAL
              </span>
              <h2 class="font-display-md text-display-md text-foreground">Iniciar sesión</h2>
              <p class="font-body text-body text-muted-foreground">
                Ingresá a tu cuenta para gestionar tu catálogo y operaciones.
              </p>
            </div>

            <!-- Banner: cuenta creada exitosamente (viene de /register?registered=1) -->
            @if (showRegisteredBanner()) {
              <div
                role="status"
                class="px-4 py-3 rounded-lg bg-primary-container/10 border border-primary-container/30 text-primary-container font-body-sm text-body-sm"
              >
                ¡Cuenta creada! Iniciá sesión con tus datos.
              </div>
            }

            <!-- Banner: error del store -->
            @if (store.error()) {
              <div
                role="alert"
                class="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive font-body-sm text-body-sm"
              >
                {{ store.error() }}
              </div>
            }

            <!-- Form -->
            <form class="space-y-5" [formGroup]="form" (ngSubmit)="onSubmit()">
              <div class="space-y-1.5">
                <label
                  for="email"
                  class="font-body-sm text-body-sm font-medium text-foreground block"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  formControlName="email"
                  type="email"
                  placeholder="vos@empresa.com"
                  autocomplete="email"
                  class="w-full h-10 px-3 py-2 rounded font-body-sm text-body-sm border border-border bg-card text-foreground placeholder:text-secondary-fixed-dim focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                  [attr.aria-invalid]="fieldHasError('email') ? true : null"
                />
                @if (fieldHasError('email')) {
                  <p class="font-body-sm text-body-sm text-destructive mt-1">
                    Ingresá un email válido.
                  </p>
                }
              </div>

              <div class="space-y-1.5">
                <div class="flex justify-between items-center">
                  <label
                    for="password"
                    class="font-body-sm text-body-sm font-medium text-foreground block"
                  >
                    Contraseña
                  </label>
                  <a
                    href="#"
                    class="font-body-sm text-body-sm text-accent hover:text-accent/80 hover:underline underline-offset-4 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div class="relative">
                  <input
                    id="password"
                    formControlName="password"
                    [type]="passwordVisible() ? 'text' : 'password'"
                    placeholder="••••••••"
                    autocomplete="current-password"
                    class="w-full h-10 px-3 py-2 rounded font-body-sm text-body-sm border border-border bg-card text-foreground placeholder:text-secondary-fixed-dim focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors pr-10 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                    [attr.aria-invalid]="fieldHasError('password') ? true : null"
                  />
                  <button
                    type="button"
                    (click)="togglePassword()"
                    [attr.aria-label]="
                      passwordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    "
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    <span aria-hidden="true" class="material-symbols-outlined text-[20px]">
                      {{ passwordVisible() ? 'visibility_off' : 'visibility' }}
                    </span>
                  </button>
                </div>
                @if (fieldHasError('password')) {
                  <p class="font-body-sm text-body-sm text-destructive mt-1">
                    Mínimo 8 caracteres.
                  </p>
                }
              </div>

              <button
                type="submit"
                [disabled]="form.invalid || store.loading()"
                class="w-full h-12 rounded-lg bg-primary-container text-on-primary font-body text-body font-semibold hover:bg-primary-container/90 focus:outline-none focus:ring-2 focus:ring-primary-container focus:ring-offset-2 focus:ring-offset-background transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-container"
              >
                @if (store.loading()) {
                  Iniciando sesión…
                } @else {
                  Iniciar sesión
                }
              </button>
            </form>

            <!-- Separator -->
            <div class="relative flex items-center py-2">
              <div class="flex-grow border-t border-border"></div>
              <span class="flex-shrink-0 mx-4 font-body-sm text-body-sm text-muted-foreground"
                >o</span
              >
              <div class="flex-grow border-t border-border"></div>
            </div>

            <!-- Google Button — disabled: OAuth fuera del alcance de la prueba (ver Ej. 5) -->
            <button
              type="button"
              disabled
              title="Inicio de sesión con Google no implementado — fuera del alcance de esta prueba"
              class="w-full h-12 rounded-lg border border-border bg-transparent text-foreground font-body text-body font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </button>

            <!-- Footer Link -->
            <div class="text-center pt-4">
              <span class="font-body-sm text-body-sm text-muted-foreground">
                ¿No tenés cuenta?
                <a
                  [routerLink]="['/register']"
                  class="text-accent font-medium hover:text-accent/80 hover:underline underline-offset-4 transition-colors"
                >
                  Crear cuenta
                </a>
              </span>
            </div>
          </div>
        </main>

        <!-- Small Footer -->
        <footer class="w-full flex items-center justify-start mt-auto pt-6">
          <span class="font-body-sm text-body-sm text-muted-foreground"> © 2026 PeaKu </span>
        </footer>
      </div>

      <!-- Right Column (40%) -->
      <div class="hidden md:block md:w-[40%] relative min-h-screen">
        <div
          class="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style="background-image: url('/assets/login-field.jpg');"
        ></div>
        <div
          class="absolute inset-0 bg-gradient-to-r from-background via-background/20 to-transparent"
        ></div>
        <div class="absolute bottom-12 left-12 right-12 z-10">
          <p class="font-body-sm text-body-sm text-background drop-shadow-md max-w-sm">
            Plataforma de comercio agropecuario · Productos certificados, lotes trazables.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(AuthStore);

  readonly passwordVisible = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly showRegisteredBanner = computed(() => this.queryParams().get('registered') === '1');
  private readonly returnUrl = computed(() => this.queryParams().get('returnUrl'));

  togglePassword(): void {
    this.passwordVisible.update((v) => !v);
  }

  fieldHasError(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }

  async onSubmit(): Promise<void> {
    this.store.clearError();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    await this.store.login(this.form.getRawValue(), this.returnUrl());
  }
}
