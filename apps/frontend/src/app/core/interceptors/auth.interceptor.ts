import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SKIP_AUTH_RETRY } from '../../features/auth/data/auth.api';
import { TokenStorageService } from '../services/token-storage.service';

/**
 * Inyecta `Authorization: Bearer <accessToken>` en todas las requests salvo
 * en endpoints públicos del auth (login, register, refresh) que se identifican
 * vía el HttpContext flag `SKIP_AUTH_RETRY`.
 *
 * No verifica expiración del token — eso lo decide el backend y lo maneja
 * el `errorInterceptor` con refresh + retry.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Si la request está marcada como auth-public (login/register/refresh),
  // no inyectar bearer ni intentar refresh sobre ella.
  if (req.context.get(SKIP_AUTH_RETRY)) {
    return next(req);
  }

  const tokens = inject(TokenStorageService);
  const token = tokens.getAccessToken();
  if (!token) return next(req);

  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
