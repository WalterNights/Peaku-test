import { Inject, Injectable } from '@nestjs/common';

import { USER_REPOSITORY, type UserRepository } from '../../domain/user.repository';

@Injectable()
export class LogoutUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<void> {
    await this.users.updateRefreshTokenHash(userId, null);
  }
}
