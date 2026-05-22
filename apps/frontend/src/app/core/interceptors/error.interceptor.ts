import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthApi, SKIP_AUTH_RETRY } from '../../features/auth/data/auth.api';
import { TokenStorageService } from '../services/token-storage.service';

/**
 * Captura globalmente 401 en cualquier request autenticada:
 *  1. Si la request está marcada como `SKIP_AUTH_RETRY` (login/register/refresh)
 *     → no intentar refresh (evita loops infinitos).
 *  2. Si hay refreshToken en storage → llamar a /refresh.
 *     - Si el refresh es OK → guardar los nuevos tokens y reintentar la request original.
 *     - Si el refresh falla → limpiar storage + redirigir a /login.
 *  3. Si no hay refreshToken → limpiar storage + redirigir a /login.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      if (req.context.get(SKIP_AUTH_RETRY)) {
        // 401 en login/register/refresh → es el error real (creds inválidos, etc.).
        return throwError(() => err);
      }

      const tokens = inject(TokenStorageService);
      const api = inject(AuthApi);
      const router = inject(Router);

      const refresh = tokens.getRefreshToken();
      if (!refresh) {
        tokens.clear();
        redirectToLogin(router);
        return throwError(() => err);
      }

      return api.refresh(refresh).pipe(
        switchMap((newTokens) => {
          tokens.setTokens(newTokens);
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${newTokens.accessToken}` },
          });
          return next(retry);
        }),
        catchError((refreshErr) => {
          tokens.clear();
          redirectToLogin(router);
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

/**
 * Navega a /login preservando `returnUrl` solo si la URL actual es una ruta
 * privada distinta de las páginas auth (login/register/root). Sin esto, una
 * 401 durante el bootstrap (AuthStore.loadCurrentUser) generaría un querystring
 * inútil como `?returnUrl=/` o `?returnUrl=/login`.
 */
function redirectToLogin(router: Router): void {
  const current = router.url.split('?')[0];
  const isAuthOrRoot = !current || current === '/' || current === '/login' || current === '/register';
  void router.navigate(['/login'], isAuthOrRoot ? {} : { queryParams: { returnUrl: current } });
}
