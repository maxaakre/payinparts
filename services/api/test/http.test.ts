import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError, httpHandler, ok, parseBody, pathId } from '../src/http';
import { call, makeEvent } from './helpers';

const Schema = z.strictObject({ name: z.string() });

const echo = httpHandler(async (event) => ok(parseBody(event, Schema)));

describe('httpHandler', () => {
  it('returns JSON with status', async () => {
    const res = await call(echo, makeEvent('POST /x', { body: { name: 'Anna' } }));
    expect(res).toEqual({ status: 200, body: { name: 'Anna' } });
  });

  it('turns malformed JSON into 400, not 500', async () => {
    const res = await call(echo, makeEvent('POST /x', { rawBody: '{"name":' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('turns a missing body into 400', async () => {
    const res = await call(echo, makeEvent('POST /x'));
    expect(res.status).toBe(400);
  });

  it('reports which field is invalid', async () => {
    const res = await call(echo, makeEvent('POST /x', { body: { name: 5 } }));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('name');
  });

  it('maps HttpError to its status and code', async () => {
    const h = httpHandler(async () => {
      throw new HttpError(409, 'CONFLICT', 'Nope');
    });
    const res = await call(h, makeEvent('GET /x'));
    expect(res).toEqual({ status: 409, body: { error: { code: 'CONFLICT', message: 'Nope' } } });
  });

  it('hides internal error details', async () => {
    const h = httpHandler(async () => {
      throw new Error('secret table name exploded');
    });
    const res = await call(h, makeEvent('GET /x'));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });
});

describe('pathId', () => {
  it('returns a valid id', () => {
    expect(pathId(makeEvent('GET /api/orders/{id}', { id: 'abc-123' }))).toBe('abc-123');
  });

  it('throws 404 for a missing or odd id', () => {
    expect(() => pathId(makeEvent('GET /api/orders/{id}'))).toThrow(HttpError);
    expect(() => pathId(makeEvent('GET /api/orders/{id}', { id: '../etc' }))).toThrow(HttpError);
  });
});
