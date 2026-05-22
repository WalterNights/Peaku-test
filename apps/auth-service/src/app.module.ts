import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { envValidationSchema } from './infrastructure/config/env.validation';
import { HealthController } from './interface/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:standard' } }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', '*.password', '*.passwordHash', '*.refreshToken'],
          censor: '[REDACTED]',
        },
        autoLogging: true,
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
          limit: Number(process.env.THROTTLE_LIMIT ?? 60),
        },
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        // sanitizeFilter envuelve valores user-provided en $eq → bloquea inyección
        // de operadores Mongo ($where, $gt, $ne) como string. Reemplaza al
        // deprecated express-mongo-sanitize. Ver docs/04-seguridad.md §5.2.
        sanitizeFilter: true,
      }),
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
