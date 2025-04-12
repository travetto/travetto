import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { castTo } from '@travetto/runtime';
import { WebBodyUtil, WebRequest, WebResponse } from '@travetto/web';

export class AwsLambdaWebUtil {

  /**
   * Create a request from an api gateway event
   */
  static toWebRequest(event: APIGatewayProxyEvent, params?: Record<string, unknown>): WebRequest {
    // Build request
    const body = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined;

    return new WebRequest({
      connection: {
        protocol: 'http',
        ip: event.requestContext.identity?.sourceIp,
      },
      method: castTo(event.httpMethod.toUpperCase()),
      path: event.path,
      query: castTo(event.queryStringParameters!),
      params,
      headers: { ...event.headers, ...event.multiValueHeaders },
      body: WebBodyUtil.asUnprocessed(body)
    });
  }

  /**
   * Create an API Gateway result from a web response
   */
  static async toLambdaResult(res: WebResponse, base64Encoded: boolean = false): Promise<APIGatewayProxyResult> {
    const binaryRes = new WebResponse({ ...res, ...WebBodyUtil.toBinaryMessage(res) });
    const output = await WebBodyUtil.toBuffer(binaryRes.body);
    const isBase64Encoded = !!output.length && base64Encoded;
    const headers: Record<string, string> = {};
    const multiValueHeaders: Record<string, string[]> = {};

    binaryRes.headers.forEach((v, k) => {
      if (Array.isArray(v)) {
        multiValueHeaders[k] = v;
      } else {
        headers[k] = v;
      }
    });

    return {
      statusCode: binaryRes.statusCode ?? 200,
      isBase64Encoded,
      body: output.toString(isBase64Encoded ? 'base64' : 'utf8'),
      headers,
      multiValueHeaders,
    };
  }
}