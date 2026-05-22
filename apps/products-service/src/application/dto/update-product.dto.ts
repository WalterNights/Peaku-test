import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateProductDto } from './create-product.dto';

/**
 * Update solo permite cambiar campos mutables. SKU no se puede modificar
 * (es un identificador estable de inventario).
 */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['sku'] as const)) {}
