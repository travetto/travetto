import { configure } from '@codegenie/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import {
  AwsLambdaHandle, AwsLambdaWebServer, AwsLambdaSymbol,
  AwsLambdaConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/web-aws-lambda';
import type { WebServerHandle } from '@travetto/web';
import { KoaWebServer } from '@travetto/web-koa';
import { castTo, asFull } from '@travetto/runtime';

/**
 * Aws Lambda Web Server
 */
@Injectable(AwsLambdaSymbol)
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
    this.#handler = castTo(configure({ app: ret.callback(), ...this.awsConfig.toJSON() }));
    return ret;
  }

  override async listen(): Promise<WebServerHandle> {
    this.listening = true;
    return asFull<WebServerHandle>({});
  }
}