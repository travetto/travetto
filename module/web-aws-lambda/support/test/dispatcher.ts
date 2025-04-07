import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { WebFilterContext, WebRequest, WebResponse, WebDispatcher } from '@travetto/web';
import { asFull, castTo, Util } from '@travetto/runtime';

import { AwsLambdaWebApplication } from '../../src/application.ts';

/**
 * Create an api gateway event given a web request
 */
function toLambdaEvent(req: WebRequest): APIGatewayProxyEvent {
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
    body: req.body ? req.body.toString('base64') : req.body ?? null,
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
  app: AwsLambdaWebApplication;

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    const res = await this.app.handle(toLambdaEvent(req), asFull<Context>({}));

    return new WebResponse({
      body: Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8'),
      headers: { ...res.headers ?? {}, ...res.multiValueHeaders ?? {} },
      statusCode: res.statusCode
    });
  }
}