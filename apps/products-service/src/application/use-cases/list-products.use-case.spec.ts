import { Product } from '../../domain/product.entity';
import type {
  ListProductsCriteria,
  ListProductsResult,
  ProductRepository,
} from '../../domain/product.repository';
import { ListProductsUseCase } from './list-products.use-case';

const buildProduct = (sku: string): Product =>
  Product.create({ id: sku, sku, name: 'p', price: 10, stock: 1, category: 'cereales' });

const createMockRepo = (
  result: ListProductsResult,
  capturedCriteria?: { current?: ListProductsCriteria },
): ProductRepository => ({
  findById: jest.fn(),
  findBySku: jest.fn(),
  list: jest.fn().mockImplementation((criteria: ListProductsCriteria) => {
    if (capturedCriteria) {
      capturedCriteria.current = criteria;
    }
    return Promise.resolve(result);
  }),
  save: jest.fn(),
  update: jest.fn(),
});

describe('ListProductsUseCase', () => {
  it('returns paginated result with totalPages computed', async () => {
    const repo = createMockRepo({ items: [buildProduct('A'), buildProduct('B')], total: 42 });
    const useCase = new ListProductsUseCase(repo);

    const result = await useCase.execute({ page: 2, limit: 20 }, false);

    expect(result.items.length).toBe(2);
    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(3); // ceil(42 / 20)
  });

  it('blocks includeInactive=true when caller is NOT admin', async () => {
    const captured: { current?: ListProductsCriteria } = {};
    const repo = createMockRepo({ items: [], total: 0 }, captured);
    const useCase = new ListProductsUseCase(repo);

    await useCase.execute({ page: 1, limit: 10, includeInactive: true }, false);

    expect(captured.current?.includeInactive).toBe(false);
  });

  it('allows includeInactive=true when caller IS admin', async () => {
    const captured: { current?: ListProductsCriteria } = {};
    const repo = createMockRepo({ items: [], total: 0 }, captured);
    const useCase = new ListProductsUseCase(repo);

    await useCase.execute({ page: 1, limit: 10, includeInactive: true }, true);

    expect(captured.current?.includeInactive).toBe(true);
  });
});
