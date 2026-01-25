import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { BinaryUtil, castTo, type ByteArray } from '@travetto/runtime';
import { WebBodyUtil, WebCommonUtil, WebRequest, WebResponse } from '@travetto/web';

export class AwsLambdaWebUtil {

  /**
   * Create a request from an api gateway event
   */
  static toWebRequest(event: APIGatewayProxyEvent): WebRequest {
    // Build request
    const body = !event.body ? undefined :
      event.isBase64Encoded ?
        BinaryUtil.fromBase64String(event.body) :
        BinaryUtil.fromUTF8String(event.body);

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
      body: WebBodyUtil.markRawBinary(body)
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
    const output: ByteArray = await BinaryUtil.toByteArray(binaryResponse.body);
    const isBase64Encoded = !!output.byteLength && base64Encoded;
    const headers: Record<string, string> = {};
    const multiValueHeaders: Record<string, string[]> = {};

    binaryResponse.headers.forEach((value, key) => {
      if (Array.isArray(value)) {
        multiValueHeaders[key] = value;
      } else {
        headers[key] = value;
      }
    });

    return {
      statusCode: WebCommonUtil.getStatusCode(binaryResponse),
      isBase64Encoded,
      body: isBase64Encoded ? BinaryUtil.toBase64String(output) : BinaryUtil.toUTF8String(output),
      headers,
      multiValueHeaders,
    };
  }
}