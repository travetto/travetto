import type * as lambda from 'aws-lambda';

import { DependencyRegistry } from '@travetto/di';
import { Util } from '@travetto/base';

import type { Request } from '../../src/types';
import type { AwsLambdaRestApplication } from '../../src/extension/aws-lambda';
import type { RestServerSupport, MakeRequestConfig } from './base';

const toMultiValue = (o: Record<string, string> | undefined) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, [v]]));

const baseLambdaEvent = { resource: '/{proxy+}' };

const baseLambdaContext = {
  accountId: Util.uuid(),
  resourceId: Util.uuid(),
  requestId: Util.uuid(),
  apiId: Util.uuid(),
  requestTimeEpoch: 1428582896000,
  resourcePath: '/{proxy+}',
  protocol: 'HTTP/1.1'
};

/**
 * AWS Lambda support for invoking directly
 */
export class AwsLambdaRestServerSupport implements RestServerSupport {

  private lambda: AwsLambdaRestApplication;

  async init() {
    const rest = await import('../..');

    Object.assign(
      await DependencyRegistry.getInstance(rest.RestCookieConfig),
      { active: true, secure: false, signed: false }
    );

    const { AwsLambdaRestApplication: App, AwsLambdaSym } = await import('../../src/extension/aws-lambda');
    this.lambda = await DependencyRegistry.getInstance(App, AwsLambdaSym);
    return await this.lambda.run();
  }

  async execute(method: Request['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}) {

    const res = (await this.lambda.handle({
      ...baseLambdaEvent,
      path,
      httpMethod: method,
      queryStringParameters: query ?? {},
      headers: headers as Record<string, string>,
      isBase64Encoded: true,
      body: body ? body.toString('base64') : body ?? null,
      multiValueQueryStringParameters: toMultiValue(query),
      multiValueHeaders: toMultiValue(headers as Record<string, string>),
      requestContext: { ...baseLambdaContext, path, httpMethod: method }
    } as lambda.APIGatewayProxyEvent, {} as lambda.Context))!;

    return {
      status: res.statusCode,
      body: Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8'),
      headers: Object.fromEntries([
        ...Object.entries(res.headers as Record<string, string>),
        ...Object.entries((res.multiValueHeaders ?? {}) as Record<string, string[]>)
      ])
    };
  }
}
