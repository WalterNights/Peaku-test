import { Inject, Injectable } from '@nestjs/common';
import type { UserPublic } from '@peaku/shared';

import { UserNotFoundError } from '../../domain/errors';
import { USER_REPOSITORY, type UserRepository } from '../../domain/user.repository';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserPublic> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(user.firstName ? { firstName: user.firstName } : {}),
      ...(user.lastName ? { lastName: user.lastName } : {}),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
