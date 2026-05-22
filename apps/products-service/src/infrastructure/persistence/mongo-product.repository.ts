import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FilterQuery } from 'mongoose';
import { Model } from 'mongoose';

import { DuplicateSkuError } from '../../domain/errors';
import { Product } from '../../domain/product.entity';
import type {
  ListProductsCriteria,
  ListProductsResult,
  ProductRepository,
} from '../../domain/product.repository';
import { ProductSchema, type ProductDocument } from './product.schema';

interface MongoDuplicateError {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

@Injectable()
export class MongoProductRepository implements ProductRepository {
  constructor(@InjectModel(ProductSchema.name) private readonly model: Model<ProductDocument>) {}

  async findById(id: string): Promise<Product | null> {
    const doc = await this.model
      .findOne({ _id: id, deletedAt: null })
      .lean<ProductDocument | null>()
      .exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const normalized = sku.trim().toUpperCase();
    const doc = await this.model.findOne({ sku: normalized }).lean<ProductDocument | null>().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async list(criteria: ListProductsCriteria): Promise<ListProductsResult> {
    const filter: FilterQuery<ProductDocument> = criteria.includeInactive
      ? {}
      : { deletedAt: null, isActive: true };

    if (criteria.category) {
      filter.category = criteria.category;
    }

    if (criteria.search) {
      // Escapamos chars regex para evitar inyección + ReDoS.
      const escaped = criteria.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { sku: { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (criteria.page - 1) * criteria.limit;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(criteria.limit)
        .lean<ProductDocument[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { items: items.map((d) => this.toEntity(d)), total };
  }

  async save(product: Product): Promise<Product> {
    try {
      const created = await this.model.create({
        _id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        isActive: product.isActive,
        deletedAt: product.deletedAt,
      });
      return this.toEntity(created.toObject() as ProductDocument);
    } catch (err) {
      const e = err as MongoDuplicateError;
      if (e.code === 11000 && e.keyPattern && 'sku' in e.keyPattern) {
        throw new DuplicateSkuError(product.sku);
      }
      throw err;
    }
  }

  async update(product: Product): Promise<Product> {
    await this.model
      .updateOne(
        { _id: product.id },
        {
          $set: {
            name: product.name,
            description: product.description,
            price: product.price,
            stock: product.stock,
            category: product.category,
            isActive: product.isActive,
            deletedAt: product.deletedAt,
          },
        },
      )
      .exec();
    return product;
  }

  private toEntity(doc: ProductDocument): Product {
    return Product.restore({
      id: (doc._id as unknown as { toString(): string }).toString(),
      sku: doc.sku,
      name: doc.name,
      description: doc.description,
      price: doc.price,
      stock: doc.stock,
      category: doc.category,
      isActive: doc.isActive,
      deletedAt: doc.deletedAt,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
      updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt,
    });
  }
}
