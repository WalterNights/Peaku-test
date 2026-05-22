import { DuplicateSkuError } from '../../domain/errors';
import { Product } from '../../domain/product.entity';
import type { ProductRepository } from '../../domain/product.repository';
import type { CreateProductDto } from '../dto/create-product.dto';
import { CreateProductUseCase } from './create-product.use-case';

const createMockRepo = (overrides: Partial<ProductRepository> = {}): ProductRepository => ({
  findById: jest.fn(),
  findBySku: jest.fn().mockResolvedValue(null),
  list: jest.fn(),
  save: jest.fn().mockImplementation((p: Product) => Promise.resolve(p)),
  update: jest.fn(),
  ...overrides,
});

const baseDto: CreateProductDto = {
  sku: 'soja-2024-001',
  name: 'Soja Premium',
  price: 480.5,
  stock: 1500,
  category: 'cereales',
};

describe('CreateProductUseCase', () => {
  it('creates a product when sku is available, normalizing to uppercase', async () => {
    const repo = createMockRepo();
    const useCase = new CreateProductUseCase(repo);

    const result = await useCase.execute(baseDto);

    expect(repo.findBySku).toHaveBeenCalledWith('SOJA-2024-001');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.sku).toBe('SOJA-2024-001');
    expect(result.name).toBe('Soja Premium');
    expect(result.isActive).toBe(true);
    expect(result.deletedAt).toBeNull();
  });

  it('throws DuplicateSkuError if SKU is already taken (case-insensitive)', async () => {
    const existing = Product.create({
      id: 'p1',
      sku: 'SOJA-2024-001',
      name: 'X',
      price: 100,
      stock: 1,
      category: 'cereales',
    });
    const repo = createMockRepo({ findBySku: jest.fn().mockResolvedValue(existing) });
    const useCase = new CreateProductUseCase(repo);

    await expect(useCase.execute(baseDto)).rejects.toBeInstanceOf(DuplicateSkuError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('preserves optional fields (description, isActive=false)', async () => {
    const repo = createMockRepo();
    const useCase = new CreateProductUseCase(repo);

    const result = await useCase.execute({
      ...baseDto,
      description: '  Lote A-7  ',
      isActive: false,
    });

    expect(result.description).toBe('Lote A-7');
    expect(result.isActive).toBe(false);
  });
});
