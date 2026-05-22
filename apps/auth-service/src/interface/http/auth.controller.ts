import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPublic } from '@peaku/shared';

import { LoginDto } from '../../application/dto/login.dto';
import { RefreshDto } from '../../application/dto/refresh.dto';
import { RegisterDto } from '../../application/dto/register.dto';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case';
import { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import { LogoutUserUseCase } from '../../application/use-cases/logout-user.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthTokensResponseDto, UserProfileResponseDto } from './dtos/auth-response.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly logoutUseCase: LogoutUserUseCase,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiCreatedResponse({ description: 'Usuario creado', type: UserProfileResponseDto })
  @ApiConflictResponse({ description: 'Email ya registrado' })
  async register(@Body() dto: RegisterDto): Promise<{ id: string; email: string }> {
    return this.registerUseCase.execute(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login con email y password' })
  @ApiOkResponse({ description: 'Tokens emitidos', type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto): Promise<AuthTokensResponseDto> {
    return this.loginUseCase.execute(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotar tokens con un refresh válido' })
  @ApiOkResponse({ description: 'Nuevos tokens emitidos', type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token inválido o reutilizado' })
  async refresh(@Body() dto: RefreshDto): Promise<AuthTokensResponseDto> {
    return this.refreshUseCase.execute(dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiOkResponse({ description: 'Perfil del usuario', type: UserProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  async me(@CurrentUser() user: { sub: string }): Promise<UserPublic> {
    return this.getCurrentUserUseCase.execute(user.sub);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoca el refresh token del usuario actual' })
  async logout(@CurrentUser() user: { sub: string }): Promise<void> {
    await this.logoutUseCase.execute(user.sub);
  }
}
