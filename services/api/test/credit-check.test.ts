import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../src/handlers/credit-check';
import { orderItem } from './fixtures';
import { call, makeEvent } from './helpers';

const ddb = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddb.reset());

const check = (body: unknown) =>
  call(handler, makeEvent('POST /api/orders/{id}/credit-check', { id: 'o1', body }));

describe('POST /api/orders/{id}/credit-check', () => {
  it('approves and saves the decision', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    ddb.on(PutCommand).resolves({});
    const res = await check({ personaId: 'anna', monthlyIncomeKr: 38000 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.decidedAt).toBeDefined();
    const put = ddb.commandCalls(PutCommand)[0]!.args[0].input;
    expect(put.Item?.SK).toBe('DECISION');
    expect(put.Item?.rulesVersion).toBe('rules-2026-09-v1');
  });

  it('lets the customer re-run the check before confirming (overwrites)', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    ddb.on(PutCommand).resolves({});
    await check({ personaId: 'anna', monthlyIncomeKr: 38000 });
    const put = ddb.commandCalls(PutCommand)[0]!.args[0].input;
    expect(put.ConditionExpression).toBeUndefined();
  });

  it('declines the always-decline persona', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    ddb.on(PutCommand).resolves({});
    const res = await check({ personaId: 'olle', monthlyIncomeKr: 30000 });
    expect(res.body.status).toBe('declined');
  });

  it('refuses a confirmed order', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem({ status: 'confirmed' }) });
    const res = await check({ personaId: 'anna', monthlyIncomeKr: 38000 });
    expect(res.status).toBe(409);
    expect(ddb.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('refuses a pay-now order', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem({ option: 'pay_now' }) });
    expect((await check({ personaId: 'anna', monthlyIncomeKr: 38000 })).status).toBe(409);
  });

  it('returns 404 for an unknown order', async () => {
    ddb.on(GetCommand).resolves({});
    expect((await check({ personaId: 'anna', monthlyIncomeKr: 38000 })).status).toBe(404);
  });

  it('rejects an unknown persona', async () => {
    expect((await check({ personaId: 'bob', monthlyIncomeKr: 38000 })).status).toBe(400);
  });

  it('rejects a fractional income without touching the database', async () => {
    const res = await check({ personaId: 'anna', monthlyIncomeKr: 38000.5 });
    expect(res.status).toBe(400);
    expect(ddb.calls()).toHaveLength(0);
  });
});
