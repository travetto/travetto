import type lambda from 'aws-lambda';

import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { Request, ServerHandle, RestCookieConfig } from '@travetto/rest';
import {
  RestServerSupport, MakeRequestConfig, MakeRequestResponse,
  headerToShape as valuesToShape
} from '@travetto/rest/support/test/server-support/base';
import { Util } from '@travetto/runtime';

import { AwsLambdaRestApplication } from '../../src/server';

const baseLambdaEvent: Pick<lambda.APIGatewayProxyEvent, 'resource' | 'pathParameters' | 'stageVariables'> = {
  resource: '/{proxy+}',
  pathParameters: {},
  stageVariables: {},
};

const baseLambdaContext = {
  accountId: Util.uuid(),
  resourceId: Util.uuid(),
  requestId: Util.uuid(),
  apiId: Util.uuid(),
  requestTimeEpoch: 1428582896000,
  resourcePath: '/{proxy+}',
  protocol: 'HTTP/1.1',
  authorizer: {},
  identity: {
    accessKey: '', apiKeyId: '', accountId: '', caller: '', clientCert: {
      clientCertPem: '', issuerDN: '', serialNumber: '', subjectDN: '',
      validity: { notAfter: '', notBefore: '' }
    }, apiKey: '',
    cognitoAuthenticationProvider: '', cognitoAuthenticationType: '', cognitoIdentityId: '',
    cognitoIdentityPoolId: '', principalOrgId: '', sourceIp: '127.0.0.1', user: '',
    userAgent: '', userArn: ''
  },
  stage: '',
} as lambda.APIGatewayProxyEvent['requestContext'];

const baseContext: lambda.Context = {
  awsRequestId: baseLambdaContext.requestId,
  logStreamName: '',
  logGroupName: '',
  memoryLimitInMB: '100',
  invokedFunctionArn: '',
  functionVersion: '1',
  functionName: '',
  callbackWaitsForEmptyEventLoop: false,
  getRemainingTimeInMillis() {
    return 100;
  },
  done(error?: Error, result?: unknown) { },
  fail(error: Error | string) { },
  succeed(...args: unknown[]) { }
};

/**
 * AWS Lambda support for invoking directly
 */
export class AwsLambdaRestServerSupport implements RestServerSupport {

  #lambda: AwsLambdaRestApplication;

  async init(qualifier?: symbol): Promise<ServerHandle> {
    await RootRegistry.init();

    Object.assign(
      await DependencyRegistry.getInstance(RestCookieConfig),
      { active: true, secure: false, signed: false }
    );

    this.#lambda = await DependencyRegistry.getInstance(AwsLambdaRestApplication, qualifier);
    return await this.#lambda.run();
  }

  async execute(method: Request['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}): Promise<MakeRequestResponse<Buffer>> {
    const multiValueHeaders = valuesToShape.multi(headers);

    const res = (await this.#lambda.handle({
      ...baseLambdaEvent,
      path,
      httpMethod: method,
      queryStringParameters: (query ?? {}) as Record<string, string>,
      headers: valuesToShape.single(headers ?? {}),
      isBase64Encoded: true,
      body: body ? body.toString('base64') : body ?? null,
      multiValueQueryStringParameters: valuesToShape.multi((query ?? {}) as Record<string, string>),
      multiValueHeaders,
      requestContext: { ...baseLambdaContext, path, httpMethod: method },
    }, { ...baseContext }));

    return {
      status: res.statusCode,
      body: Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8'),
      headers: valuesToShape.multi({
        ...(res.headers ?? {}) as Record<string, string>,
        ...(res.multiValueHeaders ?? {}) as Record<string, string | string[]>
      })
    };
  }
}