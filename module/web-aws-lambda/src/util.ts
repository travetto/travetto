import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import zlib from 'node:zlib';

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { asFull, castTo, Util } from '@travetto/runtime';
import { WebHeaders, WebRequest, WebResponse } from '@travetto/web';

const baseLambdaContext = asFull<APIGatewayProxyEvent['requestContext']>({
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


export class AwsLambdaWebUtil {
  /**
   * Create a request from an api gateway event
   * @param event 
   * @param params 
   * @returns 
   */
  static toWebRequest(event: APIGatewayProxyEvent, params: Record<string, unknown>): WebRequest {
    // Build request
    const body = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined;
    const req = new WebRequest({
      protocol: castTo(event.requestContext.protocol ?? 'http'),
      method: castTo(event.httpMethod.toUpperCase()),
      path: event.path,
      query: castTo(event.queryStringParameters!),
      params,
      remoteIp: event.requestContext.identity.sourceIp,
      headers: { ...event.headers, ...event.multiValueHeaders },
      inputStream: body ? Readable.from(body) : undefined
    });
    return req;
  }

  /**
   * Create an api gateway event given a web request
   * @param req 
   * @returns 
   */
  static toLambdaEvent(req: WebRequest): APIGatewayProxyEvent {
    const queryEntries = Object.entries(req.query ?? {});
    const singleHeaders: Record<string, string> = {};
    const multiHeaders: Record<string, string[]> = {};
    req.headers.forEach((v, k) => {
      singleHeaders[k] = Array.isArray(v) ? v.join('; ') : v;
      multiHeaders[k] = req.headers.getList(k) ?? [];
    });

    return {
      resource: '/{proxy+}',
      pathParameters: {},
      stageVariables: {},
      path: req.path,
      httpMethod: req.method,
      queryStringParameters: Object.fromEntries(queryEntries.map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v?.toString()])),
      headers: singleHeaders,
      isBase64Encoded: true,
      body: req.body ? req.body.toString('base64') : req.body ?? null,
      multiValueQueryStringParameters: Object.fromEntries(queryEntries.map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
      multiValueHeaders: multiHeaders,
      requestContext: { ...baseLambdaContext, path: req.path, httpMethod: req.method },
    }
  }

  /**
   * Create an API Gateway result from a web response   
   */
  static async toLambdaResult(res: WebResponse, base64Encoded: boolean = false): Promise<APIGatewayProxyResult> {
    let output = res.body;

    if (!Buffer.isBuffer(output)) {
      output = await buffer(output);
    }

    const isBase64Encoded = !!output.length && base64Encoded;
    const headers: Record<string, string> = {};
    const multiValueHeaders: Record<string, string[]> = {};

    res.headers.forEach((v, k) => {
      if (Array.isArray(v)) {
        multiValueHeaders[k] = v;
      } else {
        headers[k] = v;
      }
    });

    return {
      statusCode: res.statusCode ?? 200,
      isBase64Encoded,
      body: output.toString(isBase64Encoded ? 'base64' : 'utf8'),
      headers,
      multiValueHeaders,
    };
  }

  /**
   * Create a web response from an API Gateway result
   */
  static toWebResponse(res: APIGatewayProxyResult): WebResponse<Buffer> {
    let resBody: Buffer = Buffer.from(res.body, res.isBase64Encoded ? 'base64' : 'utf8');

    const resHeaders = new WebHeaders({ ...res.headers ?? {}, ...res.multiValueHeaders ?? {} });

    switch (resHeaders.getList('Content-Encoding')?.[0]) {
      case 'gzip': resBody = zlib.gunzipSync(resBody); break;
      case 'deflate': resBody = zlib.inflateSync(resBody); break;
      case 'br': resBody = zlib.brotliDecompressSync(resBody); break;
    }

    return WebResponse.from(resBody).with({ statusCode: res.statusCode, headers: resHeaders });
  }
}