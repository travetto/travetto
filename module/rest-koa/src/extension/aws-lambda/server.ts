// @file-if @vendia/serverless-express
import * as serverless from '@vendia/serverless-express';
import type * as lambda from 'aws-lambda';

import { Injectable } from '@travetto/di';
import { ConfigManager } from '@travetto/config';
import { AwsLambdaRestServer, AwsLambdaSym } from '@travetto/rest/src/extension/aws-lambda';
import { ServerHandle } from '@travetto/rest/src/types';

import { KoaRestServer } from '../../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaSym)
export class AwsLambdaKoaRestServer extends KoaRestServer implements AwsLambdaRestServer {

  #handler: ReturnType<(typeof serverless)['configure']>;

  /**
   * Handler method for the proxy
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return this.#handler(event, context, null as any) as Promise<lambda.APIGatewayProxyResult>
  }

  init() {
    const ret = super.init();
    const config = ConfigManager.get('rest.aws');
    this.#handler = serverless.configure({ app: ret.callback(), binaryMimeTypes: config.binaryMimeTypes as string[] ?? [] });
    return ret;
  }

  async listen() {
    this.listening = true;
    return {} as ServerHandle;
  }
}