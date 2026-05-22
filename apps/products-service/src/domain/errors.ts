export class ProductNotFoundError extends Error {
  constructor(public readonly identifier: string) {
    super(`Product not found: ${identifier}`);
    this.name = 'ProductNotFoundError';
  }
}

export class DuplicateSkuError extends Error {
  constructor(public readonly sku: string) {
    super(`SKU already exists: ${sku}`);
    this.name = 'DuplicateSkuError';
  }
}
