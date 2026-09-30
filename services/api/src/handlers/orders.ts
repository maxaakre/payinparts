import { randomUUID } from 'node:crypto';
import { calculatePlan, CreateOrderRequest, findProduct, needsCreditCheck } from '@payinparts/core';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { confirmOrder, getOrder, putOrder, type OrderMeta } from '../db';
import { HttpError, httpHandler, logger, ok, parseBody, pathId, type HttpResult } from '../http';

async function createOrder(event: APIGatewayProxyEventV2): Promise<HttpResult> {
  const input = parseBody(event, CreateOrderRequest);
  const product = findProduct(input.productId);
  if (!product) throw new HttpError(400, 'VALIDATION_ERROR', 'Unknown product');

  const order: OrderMeta = {
    id: randomUUID(),
    productId: product.id,
    productName: product.name,
    option: input.option,
    plan: calculatePlan(product.priceOre, input.option),
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  await putOrder(order);
  logger.info('Order created', { orderId: order.id, option: order.option });
  return ok(order, 201);
}

async function loadOrder(event: APIGatewayProxyEventV2) {
  const order = await getOrder(pathId(event));
  if (!order) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  return order;
}

async function confirm(event: APIGatewayProxyEventV2): Promise<HttpResult> {
  const order = await loadOrder(event);
  // Double-click safe: an already confirmed order is returned as is
  if (order.status === 'confirmed') return ok(order);
  if (needsCreditCheck(order.option) && order.decision?.status !== 'approved') {
    throw new HttpError(409, 'CONFLICT', 'This order needs an approved credit check first');
  }
  const confirmedAt = new Date().toISOString();
  const updated = await confirmOrder(order.id, confirmedAt);
  if (!updated) return ok(await loadOrder(event)); // someone else confirmed it first
  logger.info('Order confirmed', { orderId: order.id });
  return ok({ ...order, status: 'confirmed', confirmedAt });
}

export const handler = httpHandler(async (event) => {
  switch (event.routeKey) {
    case 'POST /api/orders':
      return createOrder(event);
    case 'GET /api/orders/{id}':
      return ok(await loadOrder(event));
    case 'POST /api/orders/{id}/confirm':
      return confirm(event);
    default:
      throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  }
});
