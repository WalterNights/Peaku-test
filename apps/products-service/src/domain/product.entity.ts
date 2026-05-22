import type { ProductCategory } from '@peaku/shared';

export interface ProductProps {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: ProductCategory;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: number;
  readonly stock: number;
  readonly category: ProductCategory;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: ProductProps) {
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.description = props.description;
    this.price = props.price;
    this.stock = props.stock;
    this.category = props.category;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static restore(props: ProductProps): Product {
    return new Product(props);
  }

  static create(params: {
    id: string;
    sku: string;
    name: string;
    description?: string | null;
    price: number;
    stock: number;
    category: ProductCategory;
    isActive?: boolean;
    now?: Date;
  }): Product {
    const now = params.now ?? new Date();
    return new Product({
      id: params.id,
      sku: params.sku.trim().toUpperCase(),
      name: params.name.trim(),
      description: params.description?.trim() ?? null,
      price: params.price,
      stock: params.stock,
      category: params.category,
      isActive: params.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  withUpdates(
    changes: Partial<{
      name: string;
      description: string | null;
      price: number;
      stock: number;
      category: ProductCategory;
      isActive: boolean;
    }>,
    now: Date = new Date(),
  ): Product {
    return new Product({
      id: this.id,
      sku: this.sku,
      name: changes.name?.trim() ?? this.name,
      description:
        changes.description === undefined
          ? this.description
          : changes.description === null
            ? null
            : changes.description.trim(),
      price: changes.price ?? this.price,
      stock: changes.stock ?? this.stock,
      category: changes.category ?? this.category,
      isActive: changes.isActive ?? this.isActive,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: this.deletedAt,
    });
  }

  softDelete(now: Date = new Date()): Product {
    return new Product({
      id: this.id,
      sku: this.sku,
      name: this.name,
      description: this.description,
      price: this.price,
      stock: this.stock,
      category: this.category,
      isActive: false,
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: now,
    });
  }

  get isDeleted(): boolean {
    return this.deletedAt !== null;
  }
}
