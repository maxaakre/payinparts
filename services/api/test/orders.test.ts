import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { getOrderMeta } from '../src/db';
import { handler } from '../src/handlers/orders';
import { decisionItem, orderItem } from './fixtures';
import { call, makeEvent } from './helpers';

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

describe('POST /api/orders', () => {
  it('creates a draft order with a server-side plan', async () => {
    ddb.on(PutCommand).resolves({});
    const res = await call(handler, makeEvent('POST /api/orders', { body: { productId: 'headphones', option: 'split_3' } }));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.plan.monthlyCostOre).toBe(85900);
    const put = ddb.commandCalls(PutCommand)[0]!.args[0].input;
    expect(put.Item?.SK).toBe('META');
    expect(put.ConditionExpression).toBe('attribute_not_exists(PK)');
  });

  it('rejects an unknown product', async () => {
    const res = await call(handler, makeEvent('POST /api/orders', { body: { productId: 'yacht', option: 'split_3' } }));
    expect(res.status).toBe(400);
    expect(ddb.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('rejects an unknown option', async () => {
    const res = await call(handler, makeEvent('POST /api/orders', { body: { productId: 'sofa', option: 'split_99' } }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/{id}', () => {
  it('returns the order with its decision', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem(), decisionItem('approved')] });
    const res = await call(handler, makeEvent('GET /api/orders/{id}', { id: 'o1' }));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('o1');
    expect(res.body.PK).toBeUndefined();
    expect(res.body.decision.status).toBe('approved');
  });

  it('reads with strong consistency', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem()] });
    await call(handler, makeEvent('GET /api/orders/{id}', { id: 'o1' }));
    expect(ddb.commandCalls(QueryCommand)[0]!.args[0].input.ConsistentRead).toBe(true);
  });

  it('returns 404 for an unknown order', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    const res = await call(handler, makeEvent('GET /api/orders/{id}', { id: 'missing' }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/orders/{id}/confirm', () => {
  const confirm = () => call(handler, makeEvent('POST /api/orders/{id}/confirm', { id: 'o1' }));

  it('confirms a pay-now order without a credit check', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem({ option: 'pay_now' })] });
    ddb.on(UpdateCommand).resolves({});
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.confirmedAt).toBeDefined();
  });

  it('refuses a split order without an approved decision', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem()] });
    const res = await confirm();
    expect(res.status).toBe(409);
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('refuses a split order that was declined', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem(), decisionItem('declined')] });
    expect((await confirm()).status).toBe(409);
  });

  it('confirms an approved split order', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem(), decisionItem('approved')] });
    ddb.on(UpdateCommand).resolves({});
    const res = await confirm();
    expect(res.status).toBe(200);
    const update = ddb.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(update.ConditionExpression).toBe('#status = :draft');
  });

  it('is idempotent: confirming twice returns the same order without writing', async () => {
    ddb.on(QueryCommand).resolves({ Items: [orderItem({ status: 'confirmed', confirmedAt: '2026-10-01T10:02:00.000Z' })] });
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(res.body.confirmedAt).toBe('2026-10-01T10:02:00.000Z');
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('returns 404 for an unknown order', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    expect((await confirm()).status).toBe(404);
  });
});

describe('unknown route', () => {
  it('returns 404', async () => {
    ddb.on(GetCommand).resolves({});
    const res = await call(handler, makeEvent('DELETE /api/orders/{id}', { id: 'o1' }));
    expect(res.status).toBe(404);
  });
});

describe('getOrderMeta', () => {
  it('reads with strong consistency', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    const meta = await getOrderMeta('o1');
    expect(meta?.id).toBe('o1');
    expect(ddb.commandCalls(GetCommand)[0]!.args[0].input.ConsistentRead).toBe(true);
  });
});
