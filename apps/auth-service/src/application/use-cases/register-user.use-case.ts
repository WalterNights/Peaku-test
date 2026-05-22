import { Inject, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

import { EmailAlreadyRegisteredError } from '../../domain/errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/password-hasher';
import { User } from '../../domain/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../../domain/user.repository';
import type { RegisterDto } from '../dto/register.dto';

export interface RegisterUserResult {
  id: string;
  email: string;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(dto: RegisterDto): Promise<RegisterUserResult> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const passwordHash = await this.hasher.hash(dto.password);
    const user = User.create({
      id: new Types.ObjectId().toHexString(),
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const saved = await this.users.save(user);
    return { id: saved.id, email: saved.email };
  }
}
