import type { JwtPayload, UserRole } from '@peaku/shared';

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface SignTokenInput {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenService {
  signAccessToken(input: SignTokenInput): Promise<string>;
  signRefreshToken(input: SignTokenInput): Promise<string>;
  signPair(input: SignTokenInput): Promise<AuthTokens>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
}
