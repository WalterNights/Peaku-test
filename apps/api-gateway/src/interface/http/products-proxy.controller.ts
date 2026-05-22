import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { UpstreamService } from '../../infrastructure/proxy/upstream.service';

const PRODUCTS_BASE = '/api/v1/products';

@ApiTags('products')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
@Controller({ path: 'products', version: '1' })
export class ProductsProxyController {
  private readonly productsServiceUrl: string;

  constructor(
    private readonly upstream: UpstreamService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.productsServiceUrl =
      config.get<string>('PRODUCTS_SERVICE_URL') ?? 'http://products-service:3002';
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear producto (proxy → products-service, admin only)' })
  async create(@Body() body: unknown, @Req() req: Request): Promise<unknown> {
    return this.forward('POST', '', body, req);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos paginados (proxy → products-service)' })
  @ApiOkResponse({ description: 'Lista paginada' })
  async list(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.forward('GET', '', undefined, req, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID (proxy → products-service)' })
  async findOne(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.forward('GET', `/${id}`, undefined, req);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar producto (proxy → products-service, admin only)' })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<unknown> {
    return this.forward('PATCH', `/${id}`, body, req);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete (proxy → products-service, admin only)' })
  @ApiNoContentResponse({ description: 'Producto eliminado' })
  async remove(@Param('id') id: string, @Req() req: Request): Promise<unknown> {
    return this.forward('DELETE', `/${id}`, undefined, req);
  }

  private async forward(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    req: Request,
    query?: Record<string, unknown>,
  ): Promise<unknown> {
    const result = await this.upstream.call({
      method,
      baseUrl: this.productsServiceUrl,
      path: `${PRODUCTS_BASE}${path}`,
      originalReq: req,
      ...(query ? { query } : {}),
      ...(body !== undefined ? { body } : {}),
    });

    if (result.status >= 400) {
      throw new HttpException(result.data as object, result.status);
    }
    return result.data;
  }
}
