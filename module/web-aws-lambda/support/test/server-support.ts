import type lambda from 'aws-lambda';
import zlib from 'node:zlib';

import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { WebRequest, WebServerHandle, CookieConfig, WebpHeaders, WebApplication } from '@travetto/web';
import { asFull, Util } from '@travetto/runtime';

import { WebServerSupport, MakeRequestConfig, MakeRequestResponse, } from '@travetto/web/support/test/server-support/base.ts';
import { AwsLambdaWebServer } from '../../__index__';

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

  #lambda: WebApplication<AwsLambdaWebServer>;

  async init(qualifier?: symbol): Promise<WebServerHandle> {
    await RootRegistry.init();

    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false, signed: false }
    );

    this.#lambda = await DependencyRegistry.getInstance<WebApplication<AwsLambdaWebServer>>(WebApplication, qualifier);
    return await this.#lambda.run();
  }

  async execute(method: WebRequest['method'], path: string, { query, headers, body }: MakeRequestConfig<Buffer> = {}): Promise<MakeRequestResponse<Buffer>> {
    const httpHeaders = new WebpHeaders(headers);
    const queryEntries = Object.entries(query ?? {});
    const singleHeaders: Record<string, string> = {};
    const multiHeaders: Record<string, string[]> = {};
    httpHeaders.forEach((v, k) => {
      singleHeaders[k] = Array.isArray(v) ? v.join('; ') : v;
      multiHeaders[k] = httpHeaders.getList(k) ?? [];
    });

    const res = (await this.#lambda.server.handle({
      ...baseLambdaEvent,
      path,
      httpMethod: method,
      queryStringParameters: Object.fromEntries(queryEntries.map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v?.toString()])),
      headers: singleHeaders,
      isBase64Encoded: true,
      body: body ? body.toString('base64') : body ?? null,
      multiValueQueryStringParameters: Object.fromEntries(queryEntries.map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
      multiValueHeaders: multiHeaders,
      requestContext: { ...baseLambdaContext, path, httpMethod: method },
    }, { ...baseContext }));

    let resBody: Buffer = Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8');

    const resHeaders = new WebpHeaders({ ...res.headers ?? {}, ...res.multiValueHeaders ?? {} });

    switch (resHeaders.getList('Content-Encoding')?.[0]) {
      case 'gzip': resBody = zlib.gunzipSync(resBody); break;
      case 'deflate': resBody = zlib.inflateSync(resBody); break;
      case 'br': resBody = zlib.brotliDecompressSync(resBody); break;
    }

    return { status: res.statusCode, body: resBody, headers: resHeaders };
  }
}