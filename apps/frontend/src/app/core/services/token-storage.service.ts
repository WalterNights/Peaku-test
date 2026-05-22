import { Injectable, signal } from '@angular/core';

import type { AuthTokens } from '../../features/auth/data/auth.api';

const ACCESS_KEY = 'peaku.accessToken';
const REFRESH_KEY = 'peaku.refreshToken';

/**
 * Abstrae el storage de los tokens JWT. Usa `sessionStorage` (no `localStorage`)
 * por defensa anti-XSS: el storage se limpia al cerrar la pestaña.
 *
 * Trade-off documentado en docs/04-seguridad.md: lo ideal sería httpOnly cookie
 * (no accesible vía JS), pero queda fuera del alcance de la prueba (requiere
 * cambios en el gateway para emitir Set-Cookie con SameSite/Secure).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly _accessToken = signal<string | null>(this.read(ACCESS_KEY));
  readonly accessToken = this._accessToken.asReadonly();

  setTokens(tokens: AuthTokens): void {
    sessionStorage.setItem(ACCESS_KEY, tokens.accessToken);
    sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    this._accessToken.set(tokens.accessToken);
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  getRefreshToken(): string | null {
    return this.read(REFRESH_KEY);
  }

  clear(): void {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    this._accessToken.set(null);
  }

  private read(key: string): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  }
}
