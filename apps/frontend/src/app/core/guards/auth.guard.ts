import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TokenStorageService } from '../services/token-storage.service';

/**
 * Protege rutas que requieren sesión.
 *
 * Estrategia simple: si hay accessToken en sessionStorage, dejá pasar.
 * No verificamos la expiración acá — la validación real la hace el backend
 * y el `errorInterceptor` se encarga de hacer refresh + retry si está expirado,
 * o de limpiar el storage + redirigir si el refresh también falló.
 *
 * Si no hay token, redirigimos a /login preservando `returnUrl` para volver
 * al destino original después del login.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const tokens = inject(TokenStorageService);
  const router = inject(Router);

  if (tokens.getAccessToken()) return true;

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
