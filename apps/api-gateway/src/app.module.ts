import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TOKEN_VERIFIER } from './domain/token-verifier';
import { envValidationSchema } from './infrastructure/config/env.validation';
import { UpstreamService } from './infrastructure/proxy/upstream.service';
import { JwtVerifier } from './infrastructure/security/jwt.verifier';
import { AuthProxyController } from './interface/http/auth-proxy.controller';
import { HealthController } from './interface/http/health.controller';
import { ProductsProxyController } from './interface/http/products-proxy.controller';

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
          paths: ['req.headers.authorization', '*.password', '*.token', '*.passwordHash'],
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
    HttpModule.register({
      timeout: 5_000,
      maxRedirects: 0,
    }),
    JwtModule.register({}),
  ],
  controllers: [HealthController, AuthProxyController, ProductsProxyController],
  providers: [
    { provide: TOKEN_VERIFIER, useClass: JwtVerifier },
    {
      provide: UpstreamService,
      inject: [HttpService, ConfigService],
      useFactory: (http: HttpService, config: ConfigService): UpstreamService =>
        new UpstreamService(http, config.get<string>('INTERNAL_API_KEY')),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
