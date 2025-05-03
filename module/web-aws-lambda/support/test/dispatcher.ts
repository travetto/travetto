import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { WebDispatcher, WebFilterContext, WebRequest, WebResponse } from '@travetto/web';
import { AppError, asFull, castTo } from '@travetto/runtime';

import { WebTestDispatchUtil } from '@travetto/web/support/test/dispatch-util.ts';

import { AwsLambdaWebHandler } from '../../src/handler.ts';

/**
 * Create an api gateway event given a web request
 */
function toLambdaEvent(request: WebRequest): APIGatewayProxyEvent {
  const body = request.body;
  const headers: Record<string, string> = {};
  const multiValueHeaders: Record<string, string[]> = {};
  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};

  if (!(body === undefined || body === null || Buffer.isBuffer(body))) {
    throw new AppError('Unsupported request type, only buffer bodies supported');
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
    body: body?.toString('base64')!,
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
    const event = toLambdaEvent(await WebTestDispatchUtil.applyRequestBody(request));

    const response = await this.app.handle(event, asFull<Context>({}));

    return WebTestDispatchUtil.finalizeResponseBody(
      new WebResponse<unknown>({
        body: Buffer.from(response.body, response.isBase64Encoded ? 'base64' : 'utf8'),
        headers: { ...response.headers ?? {}, ...response.multiValueHeaders ?? {} },
        context: {
          httpStatusCode: response.statusCode
        }
      }),
      true
    );
  }
}