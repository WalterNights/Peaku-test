import type { UserRole } from '@peaku/shared';

import type { User } from './user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updateRefreshTokenHash(userId: string, hash: string | null): Promise<void>;
  /** Cambia el role del usuario. Usado por el endpoint dev-only de switch-role. */
  updateRole(userId: string, role: UserRole): Promise<void>;
}
