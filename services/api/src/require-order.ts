import { getOrderMeta, type OrderMeta } from './db';
import { HttpError } from './http';

/** Loads an order's metadata, or throws a 404 the HTTP layer turns into a JSON error. */
export async function requireOrderMeta(id: string): Promise<OrderMeta> {
  const order = await getOrderMeta(id);
  if (!order) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  return order;
}
