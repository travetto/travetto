// @file-if @vendia/serverless-express
import * as serverless from '@vendia/serverless-express';
import type * as lambda from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { AwsLambdaHandler, AwsLambdaRestServer, AwsLambdaⲐ, RestAwsConfig } from '@travetto/rest/src/extension/aws-lambda';
import { ServerHandle } from '@travetto/rest/src/types';

import { KoaRestServer } from '../server';

type AwsLambdaHandle = AwsLambdaHandler['handle'];

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaⲐ)
export class AwsLambdaKoaRestServer extends KoaRestServer implements AwsLambdaRestServer {

  #handler: AwsLambdaHandle;

  @Inject()
  awsConfig: RestAwsConfig;

  /**
   * Handler method for the proxy
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): ReturnType<AwsLambdaHandle> {
    return this.#handler(event, context);
  }

  override init(): this['raw'] {
    const ret = super.init();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.#handler = serverless.configure({ app: ret.callback(), ...this.awsConfig.toJSON() }) as unknown as AwsLambdaHandle;
    return ret;
  }

  override async listen(): Promise<ServerHandle> {
    this.listening = true;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {} as ServerHandle;
  }
}