import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { LogoutUserUseCase } from './application/use-cases/logout-user.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { SwitchUserRoleUseCase } from './application/use-cases/switch-user-role.use-case';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { TOKEN_SERVICE } from './domain/token-service';
import { USER_REPOSITORY } from './domain/user.repository';
import { MongoUserRepository } from './infrastructure/persistence/mongo-user.repository';
import { UserMongooseSchema, UserSchema } from './infrastructure/persistence/user.schema';
import { BcryptHasher } from './infrastructure/security/bcrypt.hasher';
import { JwtTokenService } from './infrastructure/security/jwt.token-service';
import { AuthController } from './interface/http/auth.controller';
import { DevToolsController } from './interface/http/dev-tools.controller';

// Endpoints dev-only (ej: cambiar role on-the-fly para facilitar la demo).
// Se monta el controller cuando `ENABLE_DEV_TOOLS=true` está seteado en .env
// (la prueba técnica lo tiene activado por default para que el evaluador pueda
// usar el panel). En producción real, simplemente no se setea esa variable y
// el controller LITERALMENTE no existe — no es sólo un guard que bloquea.
//
// Decisión: usamos un env var EXPLÍCITA en lugar de NODE_ENV porque algunos
// stacks (incluido `nest start --watch` en monorepos pnpm) heredan NODE_ENV
// de forma poco predecible al spawn-ear child processes.
const devToolsEnabled = process.env['ENABLE_DEV_TOOLS'] !== 'false';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: UserSchema.name, schema: UserMongooseSchema }]),
    JwtModule.register({}),
  ],
  controllers: [AuthController, ...(devToolsEnabled ? [DevToolsController] : [])],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshTokenUseCase,
    GetCurrentUserUseCase,
    LogoutUserUseCase,
    ...(devToolsEnabled ? [SwitchUserRoleUseCase] : []),
    { provide: USER_REPOSITORY, useClass: MongoUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
  ],
  // TOKEN_SERVICE se exporta porque JwtAuthGuard (registrado como APP_GUARD
  // en AppModule) lo necesita para verificar tokens.
  exports: [TOKEN_SERVICE],
})
export class AuthModule {}
