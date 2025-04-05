import type lambda from 'aws-lambda';

import { buffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';

import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { WebServer, WebRouter, WebServerHandle, WebRequest } from '@travetto/web';
import { castTo } from '@travetto/runtime';

export const AwsLambdaWebSymbol = Symbol.for('@travetto/web-aws-lambda:entry');

@Config('web.aws')
export class AwsLambdaConfig {
  binaryMimeTypes?: string[];

  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (this.binaryMimeTypes) {
      out.binarySettings = { contentTypes: this.binaryMimeTypes };
    }
    return out;
  }
}

@Injectable(AwsLambdaWebSymbol)
export class AwsLambdaWebServer implements WebServer {

  #router: WebRouter;

  init(): unknown {
    return;
  }

  registerRouter(router: WebRouter): void {
    this.#router = router;
  }

  listen(): WebServerHandle {
    return {
      close(): void { },
      on(): void { }
    };
  }

  async handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
    context.callbackWaitsForEmptyEventLoop = false;

    // Route
    const { endpoint, params } = this.#router({
      url: event.path,
      headers: { ...event.headers, ...event.multiValueHeaders },
      method: event.httpMethod
    });

    // Build request
    const body = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : undefined;
    const req = new WebRequest({
      protocol: castTo(event.requestContext.protocol ?? 'http'),
      method: castTo(event.httpMethod.toUpperCase()),
      path: event.path,
      query: castTo(event.queryStringParameters!),
      params,
      headers: { ...event.headers, ...event.multiValueHeaders },
      inputStream: body ? Readable.from(body) : undefined
    });

    // Render
    const res = await endpoint.filter!({ req });

    let output = res.output;

    if (!Buffer.isBuffer(output)) {
      output = await buffer(output);
    }

    const isBase64Encoded = !!output.length && event.isBase64Encoded;
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