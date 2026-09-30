import { describe, expect, it } from 'vitest';
import { CreateOrderRequest, CreditCheckRequest, ExplainRequest } from '../src/contract';
import { findProduct, PRODUCTS } from '../src/products';

describe('products', () => {
  it('has 5 products with integer prices', () => {
    expect(PRODUCTS).toHaveLength(5);
    expect(PRODUCTS.every((p) => Number.isInteger(p.priceOre) && p.priceOre > 0)).toBe(true);
  });

  it('finds a product by id', () => {
    expect(findProduct('headphones')?.priceOre).toBe(249000);
    expect(findProduct('nope')).toBeUndefined();
  });
});

describe('CreateOrderRequest', () => {
  it('accepts a known option', () => {
    expect(CreateOrderRequest.safeParse({ productId: 'sofa', option: 'split_6' }).success).toBe(true);
  });
  it('rejects an unknown option', () => {
    expect(CreateOrderRequest.safeParse({ productId: 'sofa', option: 'split_99' }).success).toBe(false);
  });
});

describe('CreditCheckRequest', () => {
  it('accepts a whole income in range', () => {
    expect(CreditCheckRequest.safeParse({ personaId: 'anna', monthlyIncomeKr: 38000 }).success).toBe(true);
  });
  it.each([38000.5, -1, 200001, '38000'])('rejects income %s', (monthlyIncomeKr) => {
    expect(CreditCheckRequest.safeParse({ personaId: 'anna', monthlyIncomeKr }).success).toBe(false);
  });
  it('rejects extra fields such as a personal number', () => {
    const r = CreditCheckRequest.safeParse({ personaId: 'anna', monthlyIncomeKr: 1, personalNumber: '19900101-1234' });
    expect(r.success).toBe(false);
  });
});

describe('ExplainRequest', () => {
  it('trims and accepts a normal question', () => {
    const r = ExplainRequest.safeParse({ question: '  What if 6 months?  ', language: 'en' });
    expect(r.success && r.data.question).toBe('What if 6 months?');
  });
  it('rejects empty and too long questions', () => {
    expect(ExplainRequest.safeParse({ question: '   ', language: 'sv' }).success).toBe(false);
    expect(ExplainRequest.safeParse({ question: 'a'.repeat(501), language: 'sv' }).success).toBe(false);
  });
});
