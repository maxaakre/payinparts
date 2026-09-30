import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../src/handlers/explain-plan';
import { orderItem } from './fixtures';
import { call, makeEvent } from './helpers';

const ddb = mockClient(DynamoDBDocumentClient);
const bedrock = mockClient(BedrockRuntimeClient);

beforeEach(() => {
  ddb.reset();
  bedrock.reset();
});

const ask = (body: unknown) => call(handler, makeEvent('POST /api/orders/{id}/explain', { id: 'o1', body }));

const modelReply = {
  output: { message: { role: 'assistant' as const, content: [{ text: 'Du betalar 859 kr i månaden.' }] } },
  usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
};

describe('POST /api/orders/{id}/explain', () => {
  it('answers and counts the question', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    ddb.on(UpdateCommand).resolves({ Attributes: { count: 1 } });
    bedrock.on(ConverseCommand).resolves(modelReply);

    const res = await ask({ question: 'Förklara planen', language: 'sv' });

    expect(res).toEqual({ status: 200, body: { answer: 'Du betalar 859 kr i månaden.', questionsLeft: 19 } });
    const input = bedrock.commandCalls(ConverseCommand)[0]!.args[0].input;
    expect(input.modelId).toBe('test-model');
    expect(input.inferenceConfig?.maxTokens).toBe(400);
    expect(input.system?.[0]).toMatchObject({ text: expect.stringContaining('Answer in Swedish') });
  });

  it('returns 404 for an unknown order without calling the model or counting', async () => {
    ddb.on(GetCommand).resolves({});
    const res = await ask({ question: 'Hi', language: 'en' });
    expect(res.status).toBe(404);
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it('returns 429 when the question limit is reached', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    ddb.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: 'limit', $metadata: {} }));
    const res = await ask({ question: 'Hi', language: 'en' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it('returns 503 when Bedrock fails', async () => {
    ddb.on(GetCommand).resolves({ Item: orderItem() });
    ddb.on(UpdateCommand).resolves({ Attributes: { count: 3 } });
    bedrock.on(ConverseCommand).rejects(new Error('ThrottlingException'));
    const res = await ask({ question: 'Hi', language: 'en' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('rejects a question longer than 500 characters', async () => {
    const res = await ask({ question: 'a'.repeat(501), language: 'en' });
    expect(res.status).toBe(400);
    expect(ddb.calls()).toHaveLength(0);
  });
});
