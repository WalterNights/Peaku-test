import { Inject, Injectable } from '@nestjs/common';

import { InvalidRefreshTokenError } from '../../domain/errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/password-hasher';
import { TOKEN_SERVICE, type AuthTokens, type TokenService } from '../../domain/token-service';
import { USER_REPOSITORY, type UserRepository } from '../../domain/user.repository';
import type { RefreshDto } from '../dto/refresh.dto';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(dto: RefreshDto): Promise<AuthTokens> {
    let payload;
    try {
      payload = await this.tokens.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new InvalidRefreshTokenError();
    }

    const matches = await this.hasher.compare(dto.refreshToken, user.refreshTokenHash);
    if (!matches) {
      // Reutilización de un refresh viejo → revoco toda la familia.
      await this.users.updateRefreshTokenHash(user.id, null);
      throw new InvalidRefreshTokenError();
    }

    // Rotación: emitimos tokens nuevos y persistimos el hash del nuevo refresh.
    const pair = await this.tokens.signPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshHash = await this.hasher.hash(pair.refreshToken);
    await this.users.updateRefreshTokenHash(user.id, newRefreshHash);

    return pair;
  }
}
