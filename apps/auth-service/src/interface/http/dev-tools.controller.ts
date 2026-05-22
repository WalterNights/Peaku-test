import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { SwitchRoleDto } from '../../application/dto/switch-role.dto';
import { SwitchUserRoleUseCase } from '../../application/use-cases/switch-user-role.use-case';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokensResponseDto } from './dtos/auth-response.dto';

/**
 * Dev tools — endpoints que NO existen en producción.
 * Este controller sólo se registra cuando NODE_ENV !== 'production'
 * (ver auth.module.ts: import condicional vía spread).
 *
 * Razón de ser: facilita la demo/evaluación.
 */
@ApiTags('dev-tools')
@ApiBearerAuth('access-token')
@Controller({ path: 'auth/dev', version: '1' })
export class DevToolsController {
  constructor(private readonly switchRoleUseCase: SwitchUserRoleUseCase) {}

  @Post('switch-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV-ONLY] Cambiar el role del usuario autenticado',
    description:
      'Endpoint disponible sólo cuando NODE_ENV !== production. Permite alternar entre rol user y admin sin crear cuentas adicionales. Devuelve nuevos tokens con el role actualizado.',
  })
  @ApiBody({ schema: { example: { role: 'admin' } } })
  @ApiOkResponse({ description: 'Nuevos tokens emitidos', type: AuthTokensResponseDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
  async switchRole(
    @CurrentUser() user: { sub: string },
    @Body() dto: SwitchRoleDto,
  ): Promise<AuthTokensResponseDto> {
    return this.switchRoleUseCase.execute(user.sub, dto.role);
  }
}
