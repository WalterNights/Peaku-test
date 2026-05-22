import type { JwtPayload } from '@peaku/shared';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/**
 * El gateway sólo verifica access tokens — no firma ni renueva.
 * Comparte JWT_ACCESS_SECRET con auth-service.
 */
export interface TokenVerifier {
  verifyAccessToken(token: string): Promise<JwtPayload>;
}
