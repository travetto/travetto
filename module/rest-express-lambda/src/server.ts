import { configure } from '@codegenie/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import { RestServerHandle } from '@travetto/rest';
import { ExpressRestServer } from '@travetto/rest-express';
import { castTo, asFull } from '@travetto/runtime';
import {
  AwsLambdaHandle, AwsLambdaRestServer, AwsLambdaSymbol,
  RestAwsConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/rest-aws-lambda';

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaSymbol)
export class AwsLambdaExpressRestServer extends ExpressRestServer implements AwsLambdaRestServer {

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
    this.#handler = castTo(configure({ app: ret, ...this.awsConfig.toJSON() }));
    return ret;
  }

  override async listen(): Promise<RestServerHandle> {
    this.listening = true;
    return asFull({});
  }
}