import { IncomingMessage } from 'node:http';
import { configure } from '@codegenie/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import { WebServerHandle } from '@travetto/web';
import { ExpressWebServer } from '@travetto/web-express';
import { castTo, asFull } from '@travetto/runtime';
import {
  AwsLambdaHandle, AwsLambdaWebServer, AwsLambdaSymbol,
  AwsLambdaConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/web-aws-lambda';

/**
 * Aws Lambda Web Server
 */
@Injectable(AwsLambdaSymbol)
export class AwsLambdaExpressWebServer extends ExpressWebServer implements AwsLambdaWebServer {

  #handler: AwsLambdaHandle;

  @Inject()
  awsConfig: AwsLambdaConfig;

  /**
   * Handler method for the proxy
   */
  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): ReturnType<AwsLambdaHandle> {
    return this.#handler(event, context);
  }

  override async init(): Promise<this['raw']> {
    const ret = await super.init();
    this.#handler = castTo(configure({
      app: (req: IncomingMessage & { body?: unknown }, res) => {
        delete req.body;
        return ret(req, res);
      },
      ...this.awsConfig.toJSON()
    }));
    return ret;
  }

  override async listen(): Promise<WebServerHandle> {
    return asFull({});
  }
}