export type ProductCategory = 'cereales' | 'oleaginosas' | 'forrajeras' | 'otros';

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  'cereales',
  'oleaginosas',
  'forrajeras',
  'otros',
] as const;

export interface ProductPublic {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: ProductCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
