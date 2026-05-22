import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { UpstreamService } from '../../infrastructure/proxy/upstream.service';

const AUTH_BASE = '/api/v1/auth';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthProxyController {
  private readonly authServiceUrl: string;

  constructor(
    private readonly upstream: UpstreamService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.authServiceUrl = config.get<string>('AUTH_SERVICE_URL') ?? 'http://auth-service:3001';
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar usuario (proxy → auth-service)' })
  @ApiBody({ schema: { example: { email: 'admin@peaku.test', password: 'Pass1234!' } } })
  @ApiCreatedResponse({ description: 'Usuario creado' })
  async register(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    return this.forward('POST', '/register', body, req);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login (proxy → auth-service)' })
  @ApiBody({ schema: { example: { email: 'admin@peaku.test', password: 'Pass1234!' } } })
  @ApiOkResponse({ description: 'Tokens emitidos' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  async login(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    return this.forward('POST', '/login', body, req);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotar tokens (proxy → auth-service)' })
  @ApiBody({ schema: { example: { refreshToken: 'eyJhbGciOiJIUzI1NiIs...' } } })
  async refresh(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    return this.forward('POST', '/refresh', body, req);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Perfil del usuario actual (proxy → auth-service)' })
  @ApiOkResponse({ description: 'Perfil del usuario' })
  async me(@Req() req: Request): Promise<unknown> {
    return this.forward('GET', '/me', undefined, req);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revocar refresh token (proxy → auth-service)' })
  async logout(@Req() req: Request): Promise<unknown> {
    return this.forward('POST', '/logout', undefined, req);
  }

  @Post('dev/switch-role')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '[DEV-ONLY] Cambiar role del user autenticado (proxy → auth-service)',
    description:
      'Disponible sólo si el auth-service tiene ENABLE_DEV_TOOLS=true (default en dev). Permite alternar entre user y admin sin re-loguearse — pensado para la evaluación de la prueba.',
  })
  @ApiBody({ schema: { example: { role: 'admin' } } })
  @ApiOkResponse({ description: 'Nuevos tokens con el role actualizado' })
  async switchRole(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    return this.forward('POST', '/dev/switch-role', body, req);
  }

  private async forward(
    method: 'GET' | 'POST',
    path: string,
    body: unknown,
    req: Request,
  ): Promise<unknown> {
    const result = await this.upstream.call({
      method,
      baseUrl: this.authServiceUrl,
      path: `${AUTH_BASE}${path}`,
      originalReq: req,
      ...(body !== undefined ? { body } : {}),
    });

    if (result.status >= 400) {
      throw new HttpException(result.data as object, result.status);
    }
    return result.data;
  }
}
