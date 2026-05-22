import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { TokenStorageService } from '../../../core/services/token-storage.service';
import { AuthApi, type LoginDto, type RegisterDto, type UserPublic } from '../data/auth.api';
import { parseAuthError } from '../util/parse-auth-error';

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
};

/**
 * Single source of truth del estado de autenticación.
 * Implementa el requisito "State Management" del Ej. 2 de la prueba.
 *
 * Responsabilidades:
 *  - Login: llama al API, persiste tokens en sessionStorage, hidrata el user, navega a /products.
 *  - Register: llama al API y redirige a /login con `?registered=1`.
 *  - Logout: limpia tokens, resetea state, redirige a /login.
 *  - loadCurrentUser: en boot, si hay token guardado, hidrata el user llamando a /me.
 *  - switchRole: dev-only, cambia el rol contra el backend y rota tokens.
 *
 * Complementado por:
 *  - `errorInterceptor` (core/interceptors/) — maneja 401 globalmente con refresh + retry.
 *  - `authGuard` (core/guards/) — protege rutas privadas como /products.
 *  - `TokenStorageService` (core/services/) — abstrae sessionStorage con signal.
 *
 * Decisiones de scope (no implementado, fuera de alcance de la prueba):
 *  - Persistencia offline / multi-tab sync.
 *  - SSR-friendly storage (sessionStorage no existe en SSR).
 *  - Federación con OAuth (botones Google disabled en login/register).
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null),
  })),
  withMethods((store) => {
    const api = inject(AuthApi);
    const tokens = inject(TokenStorageService);
    const router = inject(Router);

    return {
      async login(dto: LoginDto, returnUrl?: string | null): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const newTokens = await firstValueFrom(api.login(dto));
          tokens.setTokens(newTokens);
          // El authInterceptor ya inyecta el bearer recién guardado.
          const user = await firstValueFrom(api.me());
          patchState(store, { user, loading: false });
          await router.navigateByUrl(returnUrl || '/products');
        } catch (err) {
          patchState(store, { error: parseAuthError(err, 'login'), loading: false });
        }
      },

      async register(dto: RegisterDto): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          await firstValueFrom(api.register(dto));
          patchState(store, { loading: false });
          await router.navigate(['/login'], { queryParams: { registered: '1' } });
        } catch (err) {
          patchState(store, { error: parseAuthError(err, 'register'), loading: false });
        }
      },

      logout(): void {
        tokens.clear();
        patchState(store, { user: null, error: null });
        void router.navigate(['/login']);
      },

      async loadCurrentUser(): Promise<void> {
        if (!tokens.getAccessToken()) return;
        try {
          const user = await firstValueFrom(api.me());
          patchState(store, { user });
        } catch {
          // El errorInterceptor ya habrá intentado refresh; si llegamos acá,
          // significa que el refresh también falló o no había refresh token.
          // El interceptor ya redirigió a /login y limpió el storage.
          patchState(store, { user: null });
        }
      },

      /**
       * Dev-only: cambia el role del user autenticado contra el backend,
       * guarda los nuevos tokens (con el role actualizado) y refresca el user.
       * El llamado se gatekeepea desde el componente con `environment.production`.
       */
      async switchRole(role: 'user' | 'admin'): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const newTokens = await firstValueFrom(api.switchRole(role));
          tokens.setTokens(newTokens);
          const user = await firstValueFrom(api.me());
          patchState(store, { user, loading: false });
        } catch (err) {
          patchState(store, { error: parseAuthError(err, 'switch'), loading: false });
        }
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
  withHooks({
    onInit(store) {
      // Hidrata el user al boot si quedó un token en sessionStorage de una sesión previa.
      void store.loadCurrentUser();
    },
  }),
);
