import type lambda from 'aws-lambda';
import zlib from 'node:zlib';

import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { HttpRequest, WebServerHandle, CookieConfig, HttpHeaders } from '@travetto/web';
import { asFull, Util } from '@travetto/runtime';

import { WebServerSupport, MakeRequestConfig, MakeRequestResponse, } from '@travetto/web/support/test/server-support/base.ts';

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

function toSingle(headers: HttpHeaders): Record<string, string> {
  const out = Object.fromEntries(headers.entries());
  const cookies = headers.getSetCookie();
  if (cookies.length) {
    out['set-cookie'] = cookies.join('; ');
  }
  return out;
}

function toMulti(headers: HttpHeaders): Record<string, string[]> {
  return Object.fromEntries([...headers.keys()].map(k => [k, headers.getList(k)!]));
}

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
    const httpHeaders = HttpHeaders.fromInput(headers);
    const queryEntries = Object.entries(query ?? {});

    const res = (await this.#lambda.handle({
      ...baseLambdaEvent,
      path,
      httpMethod: method,
      queryStringParameters: Object.fromEntries(queryEntries.map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v?.toString()])),
      headers: toSingle(httpHeaders),
      isBase64Encoded: true,
      body: body ? body.toString('base64') : body ?? null,
      multiValueQueryStringParameters: Object.fromEntries(queryEntries.map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
      multiValueHeaders: toMulti(httpHeaders),
      requestContext: { ...baseLambdaContext, path, httpMethod: method },
    }, { ...baseContext }));

    let resBody: Buffer = Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8');

    const resHeaders = HttpHeaders.fromInput({ ...res.headers ?? {}, ...res.multiValueHeaders ?? {} });
    const first = resHeaders.getFirst('content-encoding');

    if (/^(gzip|deflate|br)/.test(first ?? '')) {
      switch (first) {
        case 'gzip': resBody = zlib.gunzipSync(resBody); break;
        case 'deflate': resBody = zlib.inflateSync(resBody); break;
        case 'br': resBody = zlib.brotliDecompressSync(resBody); break;
      }
    }

    return { status: res.statusCode, body: resBody, headers: resHeaders };
  }
}