import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../store/auth.store';

interface PasswordStrength {
  bars: number; // 0..4 barras coloreadas
  label: string; // 'Débil' | 'Regular' | 'Buena' | 'Fuerte' | ''
  colorClass: string; // tailwind class para las barras activas
}

/**
 * Register page — fiel 1:1 al export de Stitch (apps/frontend/stitch-exports/register/)
 * con Reactive Form tipado encima del HTML estático.
 *
 * Diferencias respecto al export:
 *  - Form reactivo con validaciones (email, min 8, match confirm, terms required).
 *  - Indicador de fuerza de password DINÁMICO según longitud (el export mostraba
 *    "Buena" estático con 3 barras verdes; ahora es real).
 *  - Toggles de visibility por signals independientes.
 *  - Llamada al AuthStore.register al submit; el store maneja API + navegación.
 *  - Banner de error arriba del form si el backend devuelve 409 / 400 / 5xx.
 *  - Botón "Continuar con Google" disabled — OAuth fuera de alcance (ver Ej. 5).
 *  - Botón "Crear cuenta": removido el `pt-6 mt-4` interno del export Stitch
 *    que descentraba el texto.
 *  - Links de "términos" y "política de privacidad" siguen en `#` (no existen).
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col md:flex-row">
      <!-- Mobile hero (arriba) — visible solo en mobile (h-44 más bajo que login
           porque el form de register es más largo). -->
      <div class="md:hidden relative h-44 w-full">
        <div
          class="absolute inset-0 bg-cover bg-center"
          style="background-image: url('/assets/register-hands.jpg');"
        ></div>
        <div
          class="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"
        ></div>
        <div class="absolute top-6 left-6 flex items-center drop-shadow-sm">
          <span class="font-h3 text-h3 text-primary tracking-tight">PeaKu</span>
          <span class="w-1.5 h-1.5 rounded-full bg-accent ml-1.5"></span>
        </div>
      </div>

      <!-- LEFT COLUMN -->
      <div
        class="w-full md:w-[60%] flex flex-col justify-between p-6 md:p-12 lg:px-24 bg-background relative z-10"
      >
        <!-- Header desktop — oculto en mobile porque ya está sobre el hero -->
        <header class="hidden md:flex items-center">
          <span class="font-h3 text-h3 text-primary tracking-tight">PeaKu</span>
          <span class="w-1.5 h-1.5 rounded-full bg-accent ml-1.5"></span>
        </header>

        <!-- Main Content -->
        <main class="w-full max-w-form-column mx-auto my-auto py-12">
          <div class="mb-8">
            <span
              class="font-label-eyebrow text-label-eyebrow text-muted-foreground uppercase tracking-widest block mb-2"
            >
              NUEVA CUENTA
            </span>
            <h1 class="font-display-md text-display-md text-foreground mb-2">Crear cuenta</h1>
            <p class="font-body text-body text-muted-foreground">
              Sumate a la red de productores y compradores agropecuarios.
            </p>
          </div>

          <!-- Banner de error del backend (manejado por AuthStore) -->
          @if (store.error()) {
            <div
              role="alert"
              class="mb-5 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive font-body-sm text-body-sm"
            >
              {{ store.error() }}
            </div>
          }

          <form class="space-y-6" [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Name Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="firstName" class="block font-body text-body text-foreground">
                  Nombre
                </label>
                <input
                  id="firstName"
                  formControlName="firstName"
                  type="text"
                  placeholder="María"
                  autocomplete="given-name"
                  class="w-full h-10 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive"
                  [attr.aria-invalid]="fieldHasError('firstName') ? true : null"
                />
                @if (fieldHasError('firstName')) {
                  <p class="font-body-sm text-body-sm text-destructive mt-1">
                    Mínimo 2 caracteres.
                  </p>
                }
              </div>
              <div class="space-y-1.5">
                <label for="lastName" class="block font-body text-body text-foreground">
                  Apellido
                </label>
                <input
                  id="lastName"
                  formControlName="lastName"
                  type="text"
                  placeholder="Rodríguez"
                  autocomplete="family-name"
                  class="w-full h-10 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive"
                  [attr.aria-invalid]="fieldHasError('lastName') ? true : null"
                />
                @if (fieldHasError('lastName')) {
                  <p class="font-body-sm text-body-sm text-destructive mt-1">
                    Mínimo 2 caracteres.
                  </p>
                }
              </div>
            </div>

            <!-- Email -->
            <div class="space-y-1.5">
              <label for="email" class="block font-body text-body text-foreground">Correo</label>
              <input
                id="email"
                formControlName="email"
                type="email"
                placeholder="vos@empresa.com"
                autocomplete="email"
                class="w-full h-10 px-3 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive"
                [attr.aria-invalid]="fieldHasError('email') ? true : null"
              />
              @if (fieldHasError('email')) {
                <p class="font-body-sm text-body-sm text-destructive mt-1">
                  Ingresá un email válido.
                </p>
              } @else {
                <p class="font-body-sm text-body-sm text-muted-foreground mt-1">
                  Lo usarás para iniciar sesión.
                </p>
              }
            </div>

            <!-- Password -->
            <div class="space-y-1.5">
              <label for="password" class="block font-body text-body text-foreground">
                Contraseña
              </label>
              <div class="relative">
                <input
                  id="password"
                  formControlName="password"
                  [type]="passwordVisible() ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="w-full h-10 pl-3 pr-10 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive"
                  [attr.aria-invalid]="fieldHasError('password') ? true : null"
                />
                <button
                  type="button"
                  (click)="togglePassword()"
                  [attr.aria-label]="
                    passwordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  "
                  class="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span class="material-symbols-outlined text-[20px]">
                    {{ passwordVisible() ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
              @if (fieldHasError('password')) {
                <p class="font-body-sm text-body-sm text-destructive mt-1">
                  Mínimo 8 caracteres.
                </p>
              }
              <div class="flex items-center justify-between mt-2">
                <div class="flex gap-1 w-full max-w-[120px]">
                  @for (i of [0, 1, 2, 3]; track i) {
                    <div
                      class="h-1 flex-1 rounded-full"
                      [class]="i < strength().bars ? strength().colorClass : 'bg-[#EFEDE5]'"
                    ></div>
                  }
                </div>
                <span class="font-body-sm text-body-sm text-muted-foreground ml-2">
                  {{ strength().label }}
                </span>
              </div>
            </div>

            <!-- Confirm Password -->
            <div class="space-y-1.5">
              <label for="confirmPassword" class="block font-body text-body text-foreground">
                Confirmar contraseña
              </label>
              <div class="relative">
                <input
                  id="confirmPassword"
                  formControlName="confirmPassword"
                  [type]="confirmPasswordVisible() ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="w-full h-10 pl-3 pr-10 py-2 rounded-lg border border-border bg-card text-foreground font-body focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive"
                  [attr.aria-invalid]="confirmPasswordError() ? true : null"
                />
                <button
                  type="button"
                  (click)="toggleConfirmPassword()"
                  [attr.aria-label]="
                    confirmPasswordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  "
                  class="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span class="material-symbols-outlined text-[20px]">
                    {{ confirmPasswordVisible() ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
              @if (confirmPasswordError()) {
                <p class="font-body-sm text-body-sm text-destructive mt-1">
                  Las contraseñas no coinciden.
                </p>
              } @else {
                <p class="font-body-sm text-body-sm text-muted-foreground mt-1">
                  Repetí tu contraseña.
                </p>
              }
            </div>

            <!-- Terms Checkbox -->
            <div class="flex items-start gap-3 pt-2">
              <div class="flex items-center h-5">
                <input
                  id="terms"
                  formControlName="terms"
                  type="checkbox"
                  class="h-4 w-4 rounded-[6px] border-border text-primary-container focus:ring-accent bg-card"
                />
              </div>
              <label for="terms" class="font-body text-body text-foreground">
                Acepto los
                <a href="#" class="text-accent hover:underline underline-offset-4">
                  términos y condiciones
                </a>
                y la
                <a href="#" class="text-accent hover:underline underline-offset-4">
                  política de privacidad
                </a>
              </label>
            </div>

            <!-- Primary Button -->
            <!-- Bug del export Stitch: pt-6 mt-4 internos al botón empujaban el texto
                 al fondo. Removidos para que el texto quede centrado vertical real. -->
            <button
              type="submit"
              [disabled]="form.invalid || store.loading()"
              class="w-full h-12 rounded-lg bg-primary-container text-background font-body font-semibold hover:bg-primary transition-colors flex items-center justify-center mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-container"
            >
              @if (store.loading()) {
                Creando cuenta…
              } @else {
                Crear cuenta
              }
            </button>

            <!-- Divider -->
            <div class="relative flex items-center py-2">
              <div class="flex-grow border-t border-border"></div>
              <span class="flex-shrink-0 mx-4 text-muted-foreground font-body-sm text-body-sm"
                >o</span
              >
              <div class="flex-grow border-t border-border"></div>
            </div>

            <!-- Outline Button — disabled: OAuth fuera del alcance de la prueba (ver Ej. 5) -->
            <button
              type="button"
              disabled
              title="Registro con Google no implementado — fuera del alcance de esta prueba"
              class="w-full h-12 rounded-lg border border-border bg-transparent text-foreground font-body font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <a
                [routerLink]="['/login']"
                class="font-body text-body text-accent hover:underline underline-offset-4"
              >
                ¿Ya tenés cuenta? Iniciar sesión
              </a>
            </div>
          </form>
        </main>

        <!-- Footer -->
        <footer class="mt-8">
          <p class="font-body-sm text-body-sm text-muted-foreground">© 2026 PeaKu</p>
        </footer>
      </div>

      <!-- RIGHT COLUMN -->
      <div class="hidden md:block md:w-[40%] relative bg-surface-container-high overflow-hidden">
        <div
          class="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent z-10 w-32"
        ></div>
        <img
          alt=""
          class="absolute inset-0 w-full h-full object-cover z-0"
          src="/assets/register-hands.jpg"
        />
        <div class="absolute bottom-12 left-12 right-12 z-20">
          <p class="font-body text-body text-background drop-shadow-md max-w-sm">
            Sumate a la red de productores · Trazabilidad de lote a lote, contratos forward,
            logística refrigerada.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  readonly store = inject(AuthStore);

  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
      password: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      ],
      confirmPassword: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]],
    },
    { validators: [passwordsMatchValidator] },
  );

  readonly strength = computed<PasswordStrength>(() => {
    // Suscribirse al valor de password sin RxJS: leemos del form directo en cada CD.
    // Como signals + reactive forms están integrados en Angular 21, esto se re-evalúa
    // cuando el input cambia (forms.valueChanges dispara CD vía zoneless markForCheck).
    const v = this.form.controls.password.value ?? '';
    const len = v.length;
    if (len === 0) return { bars: 0, label: '', colorClass: 'bg-primary-container' };
    if (len < 4) return { bars: 1, label: 'Débil', colorClass: 'bg-destructive' };
    if (len < 8) return { bars: 2, label: 'Regular', colorClass: 'bg-accent' };
    if (len < 12) return { bars: 3, label: 'Buena', colorClass: 'bg-primary-container' };
    return { bars: 4, label: 'Fuerte', colorClass: 'bg-primary-container' };
  });

  togglePassword(): void {
    this.passwordVisible.update((v) => !v);
  }

  toggleConfirmPassword(): void {
    this.confirmPasswordVisible.update((v) => !v);
  }

  fieldHasError(name: 'firstName' | 'lastName' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.touched && c.invalid;
  }

  confirmPasswordError(): boolean {
    const c = this.form.controls.confirmPassword;
    return c.touched && (c.invalid || this.form.hasError('passwordsMismatch'));
  }

  async onSubmit(): Promise<void> {
    this.store.clearError();
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { firstName, lastName, email, password } = this.form.getRawValue();
    await this.store.register({ firstName, lastName, email, password });
  }
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!password || !confirm) return null;
  return password === confirm ? null : { passwordsMismatch: true };
}
