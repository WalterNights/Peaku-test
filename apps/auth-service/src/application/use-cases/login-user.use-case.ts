import { Inject, Injectable } from '@nestjs/common';

import { InvalidCredentialsError } from '../../domain/errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/password-hasher';
import { TOKEN_SERVICE, type AuthTokens, type TokenService } from '../../domain/token-service';
import { USER_REPOSITORY, type UserRepository } from '../../domain/user.repository';
import type { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(dto: LoginDto): Promise<AuthTokens> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    // Si el usuario no existe igual hacemos hash compare con un valor dummy
    // para evitar timing attacks que revelen existencia del email.
    const passwordOk = user
      ? await this.hasher.compare(dto.password, user.passwordHash)
      : await this.hasher.compare(dto.password, '$2b$12$invalidinvalidinvalidinvaliduOuoEvP1u9zJl9KdNqf0YqDz1');

    if (!user || !passwordOk) {
      throw new InvalidCredentialsError();
    }

    const pair = await this.tokens.signPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshHash = await this.hasher.hash(pair.refreshToken);
    await this.users.updateRefreshTokenHash(user.id, refreshHash);

    return pair;
  }
}
