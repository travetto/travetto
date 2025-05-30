import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { buffer } from 'node:stream/consumers';

import { castTo } from '@travetto/runtime';
import { WebBodyUtil, WebCommonUtil, WebRequest, WebResponse } from '@travetto/web';

export class AwsLambdaWebUtil {

  /**
   * Create a request from an api gateway event
   */
  static toWebRequest(event: APIGatewayProxyEvent): WebRequest {
    // Build request
    const body = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined;

    return new WebRequest({
      context: {
        connection: {
          httpProtocol: 'http',
          ip: event.requestContext.identity?.sourceIp,
        },
        httpMethod: castTo(event.httpMethod.toUpperCase()),
        httpQuery: castTo(event.queryStringParameters!),
        path: event.path,
      },
      headers: { ...event.headers, ...event.multiValueHeaders },
      body: WebBodyUtil.markRaw(body)
    });
  }

  /**
   * Create an API Gateway result from a web response
   */
  static async toLambdaResult(response: WebResponse, base64Encoded: boolean = false): Promise<APIGatewayProxyResult> {
    const binaryResponse = new WebResponse({
      context: response.context,
      ...WebBodyUtil.toBinaryMessage(response)
    });
    let output: Buffer = Buffer.alloc(0);
    if (Buffer.isBuffer(binaryResponse.body)) {
      output = binaryResponse.body;
    } else if (binaryResponse.body) {
      output = await buffer(binaryResponse.body);
    }
    const isBase64Encoded = !!output.length && base64Encoded;
    const headers: Record<string, string> = {};
    const multiValueHeaders: Record<string, string[]> = {};

    binaryResponse.headers.forEach((v, k) => {
      if (Array.isArray(v)) {
        multiValueHeaders[k] = v;
      } else {
        headers[k] = v;
      }
    });

    return {
      statusCode: WebCommonUtil.getStatusCode(binaryResponse),
      isBase64Encoded,
      body: output.toString(isBase64Encoded ? 'base64' : 'utf8'),
      headers,
      multiValueHeaders,
    };
  }
}