import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '@peaku/shared';

import type { TokenVerifier } from '../../domain/token-verifier';

@Injectable()
export class JwtVerifier implements TokenVerifier {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('Missing required config: JWT_ACCESS_SECRET');
    }
    this.secret = secret;
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'peaku-auth';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'peaku-api';
  }

  verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.secret,
      algorithms: ['HS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
  }
}
