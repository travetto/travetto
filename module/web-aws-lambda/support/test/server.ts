import type lambda from 'aws-lambda';
import zlib from 'node:zlib';

import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { HttpRequest, WebServerHandle, CookieConfig } from '@travetto/web';
import { asFull, castTo, Util } from '@travetto/runtime';

import {
  WebServerSupport, MakeRequestConfig, MakeRequestResponse,
  headerToShape as valuesToShape
} from '@travetto/web/support/test/server-support/base.ts';

import { AwsLambdaWebApplication } from '../../src/server.ts';

const baseLambdaEvent: Pick<lambda.APIGatewayProxyEvent, 'resource' | 'pathParameters' | 'stageVariables'> = {
  resource: '/{proxy+}',
  pathParameters: {},
  stageVariables: {},
};

const baseLambdaContext = asFull<lambda.APIGatewayProxyEvent['requestContext']>({
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
});

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
export class AwsLambdaWebServerSupport implements WebServerSupport {

  #lambda: AwsLambdaWebApplication;

  async init(qualifier?: symbol): Promise<WebServerHandle> {
    await RootRegistry.init();

    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false, signed: false }
    );

    this.#lambda = await DependencyRegistry.getInstance(AwsLambdaWebApplication, qualifier);
    return await this.#lambda.run();
  }

  async execute(method: HttpRequest['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}): Promise<MakeRequestResponse<Buffer>> {
    const multiValueHeaders = valuesToShape.multi(headers);

    const res = (await this.#lambda.handle({
      ...baseLambdaEvent,
      path,
      httpMethod: method,
      queryStringParameters: castTo(query ?? {}),
      headers: valuesToShape.single(headers ?? {}),
      isBase64Encoded: true,
      body: body ? body.toString('base64') : body ?? null,
      multiValueQueryStringParameters: valuesToShape.multi(castTo(query ?? {})),
      multiValueHeaders,
      requestContext: { ...baseLambdaContext, path, httpMethod: method },
    }, { ...baseContext }));

    let resBody = Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8');
    const resHeaders = valuesToShape.multi(castTo({
      ...(res.headers ?? {}),
      ...(res.multiValueHeaders ?? {})
    }));

    const first = resHeaders['content-encoding']?.[0];

    if (/^(gzip|deflate|br)/.test(first)) {
      switch (first) {
        case 'gzip': resBody = zlib.gunzipSync(resBody); break;
        case 'deflate': resBody = zlib.inflateSync(resBody); break;
        case 'br': resBody = zlib.brotliDecompressSync(resBody); break;
      }
    }

    return {
      status: res.statusCode,
      body: resBody,
      headers: resHeaders
    };
  }
}