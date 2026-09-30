import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

type Handler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

export function makeEvent(
  routeKey: string,
  opts: { body?: unknown; rawBody?: string; id?: string } = {},
): APIGatewayProxyEventV2 {
  const [method = 'GET', path = '/'] = routeKey.split(' ');
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  return {
    version: '2.0',
    routeKey,
    rawPath: path.replace('{id}', opts.id ?? ''),
    rawQueryString: '',
    headers: {},
    isBase64Encoded: false,
    body,
    pathParameters: opts.id ? { id: opts.id } : undefined,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api',
      domainName: 'example.com',
      domainPrefix: 'example',
      requestId: 'test-request',
      routeKey,
      stage: '$default',
      time: '',
      timeEpoch: 0,
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
    },
  };
}

export async function call(handler: Handler, event: APIGatewayProxyEventV2) {
  const res = await handler(event, {} as Context);
  return { status: res.statusCode, body: JSON.parse(res.body ?? 'null') };
}
