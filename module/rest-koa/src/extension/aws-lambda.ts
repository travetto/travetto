// @file-if @vendia/serverless-express
import * as serverless from '@vendia/serverless-express';
import type * as lambda from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { AwsLambdaHandler, AwsLambdaRestServer, AwsLambdaⲐ, RestAwsConfig } from '@travetto/rest/src/extension/aws-lambda';
import { ServerHandle } from '@travetto/rest/src/types';

import { KoaRestServer } from '../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaⲐ)
export class AwsLambdaKoaRestServer extends KoaRestServer implements AwsLambdaRestServer {

  #handler: AwsLambdaHandler['handle'];

  @Inject()
  awsConfig: RestAwsConfig;

  /**
   * Handler method for the proxy
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return this.#handler(event, context);
  }

  override init() {
    const ret = super.init();
    this.#handler = serverless.configure({ app: ret.callback(), ...this.awsConfig.toJSON() }) as unknown as AwsLambdaHandler['handle'];
    return ret;
  }

  override async listen() {
    this.listening = true;
    return {} as ServerHandle;
  }
}