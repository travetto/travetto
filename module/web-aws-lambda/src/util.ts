import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { BinaryUtil, castTo } from '@travetto/runtime';
import { WebRequest, WebResponse } from '@travetto/web';

export class AwsLambdaWebUtil {

  /**
   * Create a request from an api gateway event
   */
  static toWebRequest(event: APIGatewayProxyEvent, params?: Record<string, unknown>): WebRequest {
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
      body: WebRequest.markUnprocessed(body)
    });
    return req;
  }

  /**
   * Create an API Gateway result from a web response
   */
  static async toLambdaResult(res: WebResponse, base64Encoded: boolean = false): Promise<APIGatewayProxyResult> {
    const output = await BinaryUtil.toBuffer(res.toBinary().body);
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
}