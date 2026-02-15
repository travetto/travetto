import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { type WebDispatcher, type WebFilterContext, type WebRequest, WebResponse } from '@travetto/web';
import { RuntimeError, asFull, BinaryUtil, castTo, CodecUtil, type BinaryArray } from '@travetto/runtime';

import { WebTestDispatchUtil } from '@travetto/web/support/test/dispatch-util.ts';

import type { AwsLambdaWebHandler } from '../../src/handler.ts';

/**
 * Create an api gateway event given a web request
 */
function toLambdaEvent(request: WebRequest<BinaryArray>): APIGatewayProxyEvent {
  const body = request.body;
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};

  if (body && !BinaryUtil.isBinaryArray(body)) {
    throw new RuntimeError('Unsupported request type, only buffer bodies supported');
  }

  request.headers.forEach((v, k) => {
    headers[k] = Array.isArray(v) ? v.join('; ') : v;
    multiValueHeaders[k] = request.headers.getList(k) ?? [];
  });

  Object.entries(request.context.httpQuery ?? {}).forEach(([k, v]) => {
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
    path: request.context.path,
    httpMethod: request.context.httpMethod ?? 'POST',
    queryStringParameters,
    multiValueQueryStringParameters,
    headers,
    multiValueHeaders,
    isBase64Encoded: true,
    body: request.body ? CodecUtil.toBase64String(request.body) : null,
    requestContext: castTo({
      identity: castTo({ sourceIp: '127.0.0.1' }),
    }),
  };
}

/**
 * AWS Lambda support for invoking directly
 */
@Injectable()
export class LocalAwsLambdaWebDispatcher implements WebDispatcher {

  @Inject()
  app: AwsLambdaWebHandler;

  async dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const event = toLambdaEvent(await WebTestDispatchUtil.applyRequestBody(request, true));
    const response = await this.app.handle(event, asFull<Context>({}));

    return WebTestDispatchUtil.finalizeResponseBody(
      new WebResponse<unknown>({
        body: response.isBase64Encoded ?
          CodecUtil.fromBase64String(response.body) :
          CodecUtil.fromUTF8String(response.body),
        headers: { ...response.headers ?? {}, ...response.multiValueHeaders ?? {} },
        context: {
          httpStatusCode: response.statusCode
        }
      }),
      true
    );
  }
}