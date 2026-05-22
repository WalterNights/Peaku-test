import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EmailAlreadyRegisteredError } from '../../domain/errors';
import { User } from '../../domain/user.entity';
import type { UserRepository } from '../../domain/user.repository';
import { UserSchema, type UserDocument } from './user.schema';

interface MongoDuplicateError {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

@Injectable()
export class MongoUserRepository implements UserRepository {
  constructor(@InjectModel(UserSchema.name) private readonly model: Model<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.model.findById(id).lean<UserDocument | null>().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    const doc = await this.model.findOne({ email: normalized }).lean<UserDocument | null>().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async save(user: User): Promise<User> {
    try {
      const created = await this.model.create({
        _id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        refreshTokenHash: user.refreshTokenHash,
      });
      return this.toEntity(created.toObject() as UserDocument);
    } catch (err) {
      const e = err as MongoDuplicateError;
      if (e.code === 11000 && e.keyPattern && 'email' in e.keyPattern) {
        throw new EmailAlreadyRegisteredError(user.email);
      }
      throw err;
    }
  }

  async updateRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.model.updateOne({ _id: userId }, { $set: { refreshTokenHash: hash } }).exec();
  }

  async updateRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    await this.model.updateOne({ _id: userId }, { $set: { role } }).exec();
  }

  private toEntity(doc: UserDocument): User {
    return User.restore({
      id: (doc._id as unknown as { toString(): string }).toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
      firstName: doc.firstName,
      lastName: doc.lastName,
      refreshTokenHash: doc.refreshTokenHash,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    });
  }

}
