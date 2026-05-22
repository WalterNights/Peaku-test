import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { CreateProductUseCase } from './application/use-cases/create-product.use-case';
import { DeleteProductUseCase } from './application/use-cases/delete-product.use-case';
import { GetProductByIdUseCase } from './application/use-cases/get-product-by-id.use-case';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case';
import { UpdateProductUseCase } from './application/use-cases/update-product.use-case';
import { PRODUCT_REPOSITORY } from './domain/product.repository';
import { TOKEN_VERIFIER } from './domain/token-verifier';
import {
  ProductMongooseSchema,
  ProductSchema,
} from './infrastructure/persistence/product.schema';
import { MongoProductRepository } from './infrastructure/persistence/mongo-product.repository';
import { JwtVerifier } from './infrastructure/security/jwt.verifier';
import { ProductController } from './interface/http/product.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProductSchema.name, schema: ProductMongooseSchema }]),
    JwtModule.register({}),
  ],
  controllers: [ProductController],
  providers: [
    CreateProductUseCase,
    UpdateProductUseCase,
    DeleteProductUseCase,
    GetProductByIdUseCase,
    ListProductsUseCase,
    { provide: PRODUCT_REPOSITORY, useClass: MongoProductRepository },
    { provide: TOKEN_VERIFIER, useClass: JwtVerifier },
  ],
  // TOKEN_VERIFIER se exporta porque JwtAuthGuard (APP_GUARD global en
  // AppModule) lo necesita para validar tokens.
  exports: [TOKEN_VERIFIER],
})
export class ProductsModule {}
