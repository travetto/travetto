import type lambda from 'aws-lambda';

import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { WebServer, WebRouter, WebServerHandle } from '@travetto/web';

import { AwsLambdaWebUtil } from './util.ts';

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

@Injectable()
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
    const { endpoint, params } = this.#router({ path: event.path, method: event.httpMethod });

    // Build request
    const req = AwsLambdaWebUtil.toWebRequest(event, params);

    // Render
    const res = await endpoint.filter!({ req });

    return AwsLambdaWebUtil.toLambdaResult(res, event.isBase64Encoded);
  }
}