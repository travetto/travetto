import * as  serverless from '@vendia/serverless-express';

import { Inject, Injectable } from '@travetto/di';
import { ServerHandle } from '@travetto/rest';
import {
  AwsLambdaHandler, AwsLambdaRestServer, AwsLambdaⲐ,
  RestAwsConfig, LambdaContext, LambdaAPIGatewayProxyEvent
} from '@travetto/rest-aws-lambda';

import { ExpressRestServer } from '@travetto/rest-express';

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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#handler = serverless.configure({ app: ret, ...this.awsConfig.toJSON() }) as unknown as AwsLambdaHandle;
    return ret;
  }

  override async listen(): Promise<ServerHandle> {
    this.listening = true;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {} as ServerHandle;
  }
}