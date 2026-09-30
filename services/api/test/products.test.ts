import { describe, expect, it } from 'vitest';
import { handler } from '../src/handlers/products';
import { call, makeEvent } from './helpers';

describe('GET /api/products', () => {
  it('returns all products', async () => {
    const res = await call(handler, makeEvent('GET /api/products'));
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(5);
    expect(res.body.products[0].id).toBe('headphones');
  });
});
