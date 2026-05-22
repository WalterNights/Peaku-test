import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';

export interface UserPublic {
  id: string;
  email: string;
  role: 'admin' | 'user';
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RegisterResult {
  id: string;
  email: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Marca a una request para que el `errorInterceptor` NO intente refresh sobre ella
 * (evita loops infinitos en /login, /register, /refresh).
 */
export const SKIP_AUTH_RETRY = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  // El gateway expone con prefix /api/v1 (ver swagger en http://localhost:4050/api/docs).
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/auth`;
  private readonly skipRetryContext = new HttpContext().set(SKIP_AUTH_RETRY, true);

  register(dto: RegisterDto): Observable<RegisterResult> {
    return this.http.post<RegisterResult>(`${this.baseUrl}/register`, dto, {
      context: this.skipRetryContext,
    });
  }

  login(dto: LoginDto): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/login`, dto, {
      context: this.skipRetryContext,
    });
  }

  refresh(refreshToken: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(
      `${this.baseUrl}/refresh`,
      { refreshToken },
      { context: this.skipRetryContext },
    );
  }

  /**
   * Dev-only: cambia el role del usuario autenticado.
   * El endpoint sólo existe en el backend si NODE_ENV !== 'production'.
   * En producción esto va a tirar 404, y el panel del frontend que lo invoca
   * tampoco se renderiza (gated por environment.production).
   */
  switchRole(role: 'user' | 'admin'): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/dev/switch-role`, { role });
  }

  /**
   * Devuelve el perfil del usuario autenticado.
   * El `authInterceptor` inyecta el Authorization header automáticamente.
   */
  me(): Observable<UserPublic> {
    return this.http.get<UserPublic>(`${this.baseUrl}/me`);
  }
}
