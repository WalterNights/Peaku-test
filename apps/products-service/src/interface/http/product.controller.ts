import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { JwtPayload } from '@peaku/shared';

import { CreateProductDto } from '../../application/dto/create-product.dto';
import { ListProductsQueryDto } from '../../application/dto/list-products.query.dto';
import { UpdateProductDto } from '../../application/dto/update-product.dto';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case';
import { DeleteProductUseCase } from '../../application/use-cases/delete-product.use-case';
import { GetProductByIdUseCase } from '../../application/use-cases/get-product-by-id.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginatedProductsResponseDto, ProductResponseDto } from './dtos/product-response.dto';

@ApiTags('products')
@ApiBearerAuth('access-token')
@Controller({ path: 'products', version: '1' })
@UseGuards(RolesGuard)
@ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
export class ProductController {
  constructor(
    private readonly createUseCase: CreateProductUseCase,
    private readonly updateUseCase: UpdateProductUseCase,
    private readonly deleteUseCase: DeleteProductUseCase,
    private readonly getByIdUseCase: GetProductByIdUseCase,
    private readonly listUseCase: ListProductsUseCase,
  ) {}

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear producto', description: 'Requiere rol admin.' })
  @ApiCreatedResponse({ description: 'Producto creado', type: ProductResponseDto })
  @ApiConflictResponse({ description: 'SKU duplicado' })
  @ApiForbiddenResponse({ description: 'Usuario sin rol admin' })
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = await this.createUseCase.execute(dto);
    return ProductResponseDto.fromDomain(product);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos paginados' })
  @ApiOkResponse({ description: 'Lista paginada', type: PaginatedProductsResponseDto })
  async list(
    @Query() query: ListProductsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedProductsResponseDto> {
    const result = await this.listUseCase.execute(query, user.role === 'admin');
    return {
      items: result.items.map(ProductResponseDto.fromDomain),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiOkResponse({ description: 'Producto encontrado', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.getByIdUseCase.execute(id);
    return ProductResponseDto.fromDomain(product);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar producto', description: 'Requiere rol admin.' })
  @ApiOkResponse({ description: 'Producto actualizado', type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiForbiddenResponse({ description: 'Usuario sin rol admin' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.updateUseCase.execute(id, dto);
    return ProductResponseDto.fromDomain(product);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete del producto', description: 'Requiere rol admin.' })
  @ApiNoContentResponse({ description: 'Producto eliminado' })
  @ApiNotFoundResponse({ description: 'Producto no encontrado' })
  @ApiForbiddenResponse({ description: 'Usuario sin rol admin' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteUseCase.execute(id);
  }
}
