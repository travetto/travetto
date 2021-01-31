// @file-if aws-serverless-express
import * as http from 'http';
import type * as lambda from 'aws-lambda';

import * as awsServerlessExpress from 'aws-serverless-express';

import { Injectable } from '@travetto/di';
import { ConfigManager } from '@travetto/config';

import { RestServerTarget } from '@travetto/rest/src/internal/server';
import { RestLambdaSym } from '@travetto/rest/src/internal/lambda';

import { ExpressRestServer } from '../../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable({
  qualifier: RestLambdaSym,
  target: RestServerTarget
})
export class AwsLambdaExpressRestServer extends ExpressRestServer {

  private server: http.Server;

  /**
   * Handler method for the proxy
   */
  public handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return awsServerlessExpress.proxy(this.server, event, context, 'PROMISE').promise;
  }

  init() {
    const ret = super.init();
    const config = ConfigManager.get('rest.aws');
    this.server = awsServerlessExpress.createServer(ret, undefined, config.binaryMimeTypes as string[] ?? []);
    return ret;
  }

  async listen() {
    this.listening = true;
    return this.server;
  }
}