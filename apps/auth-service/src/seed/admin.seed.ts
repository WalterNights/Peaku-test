/* eslint-disable no-console, import/first */
// Si corremos el seed desde la host machine (no dentro del container), usamos
// la URI a través de 127.0.0.1 en lugar del hostname de Docker (mongo-auth).
// Esto debe ejecutarse ANTES de importar AppModule.
if (process.env['MONGO_AUTH_URI_LOCAL'] && !process.env['INSIDE_DOCKER']) {
  process.env['MONGO_URI'] = process.env['MONGO_AUTH_URI_LOCAL'];
}

import { NestFactory } from '@nestjs/core';
import { Types } from 'mongoose';

import { AppModule } from '../app.module';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher';
import { User } from '../domain/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository';

const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@peaku.test';
const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin1234!';

async function seedAdmin(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const users = app.get<UserRepository>(USER_REPOSITORY);
  const hasher = app.get<PasswordHasher>(PASSWORD_HASHER);

  try {
    const existing = await users.findByEmail(ADMIN_EMAIL);
    if (existing) {
      // Idempotente: si ya existe, garantizamos que es admin pero no pisamos password.
      if (existing.role !== 'admin') {
        // No-op: el repo no expone changeRole; lo logueamos por si hace falta promover.
        console.log(
          `[seed] User ${ADMIN_EMAIL} exists but role=${existing.role}. Promote via Mongo manually if needed.`,
        );
      } else {
        console.log(`[seed] Admin ${ADMIN_EMAIL} already exists. Skipping.`);
      }
      return;
    }

    const passwordHash = await hasher.hash(ADMIN_PASSWORD);
    const admin = User.create({
      id: new Types.ObjectId().toHexString(),
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
    });
    await users.save(admin);
    console.log(`[seed] ✓ Admin created: ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD})`);
  } finally {
    await app.close();
  }
}

seedAdmin().catch((err: unknown) => {
  console.error('[seed] Failed to seed admin:', err);
  process.exit(1);
});
