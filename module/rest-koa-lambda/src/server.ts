import { configure } from '@codegenie/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import {
  AwsLambdaHandle, AwsLambdaRestServer, AwsLambdaSymbol,
  RestAwsConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/rest-aws-lambda';
import type { RestServerHandle } from '@travetto/rest';
import { KoaRestServer } from '@travetto/rest-koa';
import { castTo, asFull } from '@travetto/runtime';

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaSymbol)
export class AwsLambdaKoaRestServer extends KoaRestServer implements AwsLambdaRestServer {

  #handler: AwsLambdaHandle;

  @Inject()
  awsConfig: RestAwsConfig;

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

  override async listen(): Promise<RestServerHandle> {
    this.listening = true;
    return asFull<RestServerHandle>({});
  }
}