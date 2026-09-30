import type {
  ApiError,
  CreateOrderInput,
  CreditCheckInput,
  ExplainInput,
  ExplainResponse,
  Order,
  Product,
  StoredDecision,
} from '@payinparts/core';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? 'INTERNAL_ERROR', err?.message ?? 'Request failed');
  }
  return data as T;
}

const orderPath = (id: string) => `/api/orders/${encodeURIComponent(id)}`;

export const api = {
  products: () => request<{ products: Product[] }>('/api/products'),
  createOrder: (input: CreateOrderInput) => request<Order>('/api/orders', { method: 'POST', body: input }),
  getOrder: (id: string) => request<Order>(orderPath(id)),
  creditCheck: (id: string, input: CreditCheckInput) =>
    request<StoredDecision>(`${orderPath(id)}/credit-check`, { method: 'POST', body: input }),
  confirm: (id: string) => request<Order>(`${orderPath(id)}/confirm`, { method: 'POST' }),
  explain: (id: string, input: ExplainInput) =>
    request<ExplainResponse>(`${orderPath(id)}/explain`, { method: 'POST', body: input }),
};
