import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { WebFilterContext, WebRequest, WebResponse, WebDispatcher } from '@travetto/web';
import { AppError, asFull, castTo, Util } from '@travetto/runtime';

import { AwsLambdaWebHandler } from '../../src/handler.ts';

function isBufferRequest(req: WebRequest): req is WebRequest<Buffer | null> {
  return req.body === undefined || req.body === null || Buffer.isBuffer(req.body);
}

/**
 * Create an api gateway event given a web request
 */
function toLambdaEvent(req: WebRequest<Buffer | null>): APIGatewayProxyEvent {
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};

  req.headers.forEach((v, k) => {
    headers[k] = Array.isArray(v) ? v.join('; ') : v;
    multiValueHeaders[k] = req.headers.getList(k) ?? [];
  });

  Object.entries(req.query ?? {}).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      multiValueQueryStringParameters[k] = v;
    } else {
      queryStringParameters[k] = v?.toString() ?? '';
    }
  });

  return {
    resource: '/{proxy+}',
    pathParameters: {},
    stageVariables: {},
    path: req.path,
    httpMethod: req.method,
    queryStringParameters,
    multiValueQueryStringParameters,
    headers,
    multiValueHeaders,
    isBase64Encoded: true,
    body: req.body?.toString('base64')!,
    requestContext: {
      accountId: Util.uuid(),
      resourceId: Util.uuid(),
      requestId: Util.uuid(),
      apiId: Util.uuid(),
      requestTimeEpoch: 1428582896000,
      resourcePath: '/{proxy+}',
      protocol: 'HTTP/1.1',
      authorizer: {},
      identity: castTo({ sourceIp: '127.0.0.1' }),
      stage: '',
      path: req.path,
      httpMethod: req.method
    },
  };
}

/**
 * AWS Lambda support for invoking directly
 */
@Injectable()
export class LocalAwsLambdaWebDispatcher implements WebDispatcher {

  @Inject()
  app: AwsLambdaWebHandler;

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    if (!isBufferRequest(req)) {
      throw new AppError('Unsupported request type, only buffer bodies supported');
    }

    const res = await this.app.handle(toLambdaEvent(req), asFull<Context>({}));

    return new WebResponse({
      body: Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8'),
      headers: { ...res.headers ?? {}, ...res.multiValueHeaders ?? {} },
      statusCode: res.statusCode
    });
  }
}