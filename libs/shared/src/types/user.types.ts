import type { UserRole } from '../constants/roles';

export interface UserPublic {
  id: string;
  email: string;
  role: UserRole;
  /** Nombre del usuario (opcional — usuarios pre-mayo-2026 no lo tienen). */
  firstName?: string;
  /** Apellido del usuario (opcional — usuarios pre-mayo-2026 no lo tienen). */
  lastName?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
