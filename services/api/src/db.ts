import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Order, StoredDecision } from '@payinparts/core';
import { tracer } from './http';

export type OrderMeta = Omit<Order, 'decision'>;

const doc = DynamoDBDocumentClient.from(tracer.captureAWSv3Client(new DynamoDBClient({})), {
  marshallOptions: { removeUndefinedValues: true },
});

function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME is not set');
  return name;
}

const pk = (id: string) => `ORDER#${id}`;

/** Remove DynamoDB keys before returning an item to callers. */
function strip<T>(item: Record<string, unknown>): T {
  const copy = { ...item };
  delete copy.PK;
  delete copy.SK;
  return copy as T;
}

const isConditionalFailure = (err: unknown) =>
  err instanceof Error && err.name === 'ConditionalCheckFailedException';

export async function putOrder(order: OrderMeta): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: tableName(),
      Item: { PK: pk(order.id), SK: 'META', ...order },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  );
}

export async function getOrderMeta(id: string): Promise<OrderMeta | undefined> {
  const res = await doc.send(new GetCommand({ TableName: tableName(), Key: { PK: pk(id), SK: 'META' } }));
  return res.Item ? strip<OrderMeta>(res.Item) : undefined;
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const res = await doc.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk(id) },
    }),
  );
  const items = res.Items ?? [];
  const meta = items.find((i) => i.SK === 'META');
  if (!meta) return undefined;
  const decision = items.find((i) => i.SK === 'DECISION');
  return { ...strip<OrderMeta>(meta), ...(decision ? { decision: strip<StoredDecision>(decision) } : {}) };
}

export async function putDecision(orderId: string, decision: StoredDecision): Promise<void> {
  await doc.send(
    new PutCommand({ TableName: tableName(), Item: { PK: pk(orderId), SK: 'DECISION', ...decision } }),
  );
}

/** Returns false when the order was not a draft (already confirmed). */
export async function confirmOrder(id: string, confirmedAt: string): Promise<boolean> {
  try {
    await doc.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: pk(id), SK: 'META' },
        UpdateExpression: 'SET #status = :confirmed, confirmedAt = :at',
        ConditionExpression: '#status = :draft',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':confirmed': 'confirmed', ':draft': 'draft', ':at': confirmedAt },
      }),
    );
    return true;
  } catch (err) {
    if (isConditionalFailure(err)) return false;
    throw err;
  }
}

/** Atomically counts AI questions. Returns the new count, or undefined when the limit is reached. */
export async function incrementAiCount(orderId: string, max: number): Promise<number | undefined> {
  try {
    const res = await doc.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: pk(orderId), SK: 'AI#COUNT' },
        UpdateExpression: 'ADD #count :one',
        ConditionExpression: 'attribute_not_exists(#count) OR #count < :max',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':max': max },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(res.Attributes?.count ?? max);
  } catch (err) {
    if (isConditionalFailure(err)) return undefined;
    throw err;
  }
}
