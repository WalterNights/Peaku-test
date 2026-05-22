import type { JwtPayload } from '@peaku/shared';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/**
 * El products-service sólo verifica access tokens (no firma).
 * El firmador vive en auth-service; ambos comparten JWT_ACCESS_SECRET.
 */
export interface TokenVerifier {
  verifyAccessToken(token: string): Promise<JwtPayload>;
}
