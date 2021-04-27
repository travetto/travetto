// @file-if @vendia/serverless-express
import * as serverless from '@vendia/serverless-express';
import type * as lambda from 'aws-lambda';

import { Injectable } from '@travetto/di';
import { ConfigManager } from '@travetto/config';
import { ServerHandle } from '@travetto/rest/src/types';
import { AwsLambdaHandler, AwsLambdaRestServer, AwsLambdaⲐ } from '@travetto/rest/src/extension/aws-lambda';

import { ExpressRestServer } from '../../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaⲐ)
export class AwsLambdaExpressRestServer extends ExpressRestServer implements AwsLambdaRestServer {

  #handler: AwsLambdaHandler['handle'];

  /**
   * Handler method for the proxy
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return this.#handler(event, context);
  }

  init() {
    const ret = super.init();
    const config = ConfigManager.get('rest.aws');
    this.#handler = serverless.configure({ app: ret, binaryMimeTypes: config.binaryMimeTypes as string[] ?? [] }) as unknown as AwsLambdaHandler['handle'];
    return ret;
  }

  async listen() {
    this.listening = true;
    return {} as ServerHandle;
  }
}