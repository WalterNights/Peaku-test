import { Inject, Injectable } from '@nestjs/common';
import type { UserRole } from '@peaku/shared';

import { UserNotFoundError } from '../../domain/errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/password-hasher';
import { TOKEN_SERVICE, type AuthTokens, type TokenService } from '../../domain/token-service';
import { USER_REPOSITORY, type UserRepository } from '../../domain/user.repository';

/**
 * Cambia el rol del usuario autenticado y emite nuevos tokens con ese rol.
 *
 * **Dev-only**: este use case se invoca exclusivamente desde el `DevToolsController`,
 * que sólo se monta en `NODE_ENV !== 'production'`. En producción, el endpoint
 * literalmente no existe — no es un guard, es ausencia del controller.
 *
 * Razón de ser: facilita la evaluación de la prueba técnica permitiendo al
 * evaluador alternar entre vistas de user normal y admin sin crear dos cuentas.
 */
@Injectable()
export class SwitchUserRoleUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
  ) {}

  async execute(userId: string, newRole: UserRole): Promise<AuthTokens> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    if (user.role !== newRole) {
      await this.users.updateRole(userId, newRole);
    }

    // Emitimos nuevos tokens con el rol actualizado para que el frontend
    // pueda usar el nuevo bearer inmediatamente sin re-loguearse.
    const pair = await this.tokens.signPair({
      sub: user.id,
      email: user.email,
      role: newRole,
    });

    // Rotamos también el refresh para mantener consistencia con el flujo
    // normal de login/refresh (un refresh hash por sesión activa).
    const refreshHash = await this.hasher.hash(pair.refreshToken);
    await this.users.updateRefreshTokenHash(userId, refreshHash);

    return pair;
  }
}
