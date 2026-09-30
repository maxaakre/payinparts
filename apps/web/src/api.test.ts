import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError } from './api';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('posts JSON and returns the body', async () => {
    const fetchFn = mockFetch(201, { id: 'o1' });
    const order = await api.createOrder({ productId: 'sofa', option: 'split_6' });
    expect(order.id).toBe('o1');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/orders');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ productId: 'sofa', option: 'split_6' });
  });

  it('turns an error response into ApiRequestError', async () => {
    mockFetch(429, { error: { code: 'RATE_LIMITED', message: 'Too many' } });
    await expect(api.explain('o1', { question: 'Hi', language: 'en' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('handles a non-JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    const err = await api.getOrder('o1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect((err as ApiRequestError).code).toBe('INTERNAL_ERROR');
  });
});
