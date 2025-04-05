import { IncomingMessage } from 'node:http';

import { configure } from '@codegenie/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import {
  AwsLambdaHandle, AwsLambdaWebServer, AwsLambdaWebSymbol,
  AwsLambdaConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/web-aws-lambda';
import type { WebServerHandle } from '@travetto/web';
import { KoaWebServer } from '@travetto/web-koa';
import { castTo, asFull } from '@travetto/runtime';

/**
 * Aws Lambda Web Server
 */
@Injectable(AwsLambdaWebSymbol)
export class AwsLambdaKoaWebServer extends KoaWebServer implements AwsLambdaWebServer {

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
    const fn = ret.callback();
    this.#handler = castTo(configure({
      app: (req: IncomingMessage & { body?: unknown }, res) => {
        delete req.body;
        return fn(req, res);
      },
      ...this.awsConfig.toJSON()
    }));
    return ret;
  }

  override async listen(): Promise<WebServerHandle> {
    return asFull<WebServerHandle>({});
  }
}