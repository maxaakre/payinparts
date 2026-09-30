import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import type { ErrorCode } from '@payinparts/core';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import type { ZodType } from 'zod';

export const logger = new Logger();
export const metrics = new Metrics();
export const tracer = new Tracer();

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type HttpResult = { status: number; body: unknown };

export const ok = (body: unknown, status = 200): HttpResult => ({ status, body });

export function parseBody<T>(event: APIGatewayProxyEventV2, schema: ZodType<T>): T {
  const raw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
  let json: unknown;
  try {
    json = JSON.parse(raw ?? '');
  } catch {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new HttpError(400, 'VALIDATION_ERROR', message);
  }
  return result.data;
}

export function pathId(event: APIGatewayProxyEventV2): string {
  const id = event.pathParameters?.id;
  if (!id || !/^[A-Za-z0-9-]{1,64}$/.test(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  }
  return id;
}

const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export function httpHandler(fn: (event: APIGatewayProxyEventV2) => Promise<HttpResult>) {
  return async (
    event: APIGatewayProxyEventV2,
    context: Context,
  ): Promise<APIGatewayProxyStructuredResultV2> => {
    logger.addContext(context);
    logger.appendKeys({ requestId: event.requestContext.requestId, route: event.routeKey });
    try {
      const result = await fn(event);
      return json(result.status, result.body);
    } catch (err) {
      if (err instanceof HttpError) {
        logger.warn('Request failed', { status: err.status, code: err.code });
        return json(err.status, { error: { code: err.code, message: err.message } });
      }
      logger.error('Unexpected error', err as Error);
      return json(500, {
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      });
    } finally {
      if (metrics.hasStoredMetrics()) metrics.publishStoredMetrics();
      logger.resetKeys();
    }
  };
}
