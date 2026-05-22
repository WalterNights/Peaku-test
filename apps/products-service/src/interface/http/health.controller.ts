import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Public()
// VERSION_NEUTRAL evita que enableVersioning() le pegue /v1/ delante.
// Combinado con setGlobalPrefix('api', { exclude: ['health'] }) en main.ts,
// queda servido como /health (raíz), no /api/v1/health.
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe', description: 'Indica si el proceso responde.' })
  liveness(): { status: 'ok'; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'products-service',
      timestamp: new Date().toISOString(),
    };
  }
}
