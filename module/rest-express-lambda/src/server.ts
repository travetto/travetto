import { configure } from '@codegenie/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import { ServerHandle } from '@travetto/rest';
import {
  AwsLambdaHandler, AwsLambdaRestServer, AwsLambdaⲐ,
  RestAwsConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/rest-aws-lambda';

import { ExpressRestServer } from '@travetto/rest-express';
import { castTo, impartial } from '@travetto/runtime';

type AwsLambdaHandle = AwsLambdaHandler['handle'];

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaⲐ)
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

  override async listen(): Promise<ServerHandle> {
    this.listening = true;
    return impartial({});
  }
}