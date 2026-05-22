import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@peaku/shared';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<ProductSchema>;

@Schema({
  collection: 'products',
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      ret['id'] = ret['_id']?.toString();
      delete ret['_id'];
      return ret;
    },
  },
})
export class ProductSchema {
  @Prop({ type: String, required: true, unique: true, uppercase: true, trim: true })
  sku!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: null, trim: true })
  description!: string | null;

  @Prop({ type: Number, required: true, min: 0.01 })
  price!: number;

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  stock!: number;

  @Prop({ type: String, required: true, enum: PRODUCT_CATEGORIES, index: true })
  category!: ProductCategory;

  @Prop({ type: Boolean, default: true })
  isActive!: boolean;

  @Prop({ type: Date, default: null, index: true })
  deletedAt!: Date | null;
}

export const ProductMongooseSchema = SchemaFactory.createForClass(ProductSchema);

// Índices compuestos útiles:
// - búsqueda por categoría y estado activo (lista por defecto excluye soft-deleted)
ProductMongooseSchema.index({ category: 1, isActive: 1, deletedAt: 1 });
// - búsqueda full-text simple sobre name + sku (case-insensitive via collation)
ProductMongooseSchema.index({ name: 'text', sku: 'text' });
