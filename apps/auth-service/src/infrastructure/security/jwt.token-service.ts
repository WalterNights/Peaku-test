import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { JwtPayload } from '@peaku/shared';

import type { AuthTokens, SignTokenInput, TokenService } from '../../domain/token-service';

// Cast helper: jsonwebtoken v9 tipa expiresIn como literal (`${n}m`/`${n}d`/…)
// pero leemos el valor del .env como string plano. Tipos seguros en runtime
// gracias a la validación de Joi (`JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`).
type ExpiresIn = JwtSignOptions['expiresIn'];

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = this.required(config, 'JWT_ACCESS_SECRET');
    this.refreshSecret = this.required(config, 'JWT_REFRESH_SECRET');
    this.accessTtl = config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    this.refreshTtl = config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'peaku-auth';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'peaku-api';
  }

  signAccessToken(input: SignTokenInput): Promise<string> {
    return this.jwt.signAsync(this.payload(input), {
      secret: this.accessSecret,
      expiresIn: this.accessTtl as ExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256',
    });
  }

  signRefreshToken(input: SignTokenInput): Promise<string> {
    return this.jwt.signAsync(this.payload(input), {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl as ExpiresIn,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256',
    });
  }

  async signPair(input: SignTokenInput): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(input),
      this.signRefreshToken(input),
    ]);
    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.accessSecret,
      algorithms: ['HS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.refreshSecret,
      algorithms: ['HS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  private payload(input: SignTokenInput): JwtPayload {
    return { sub: input.sub, email: input.email, role: input.role };
  }

  private required(config: ConfigService, key: string): string {
    const value = config.get<string>(key);
    if (!value) {
      throw new Error(`Missing required config: ${key}`);
    }
    return value;
  }
}
