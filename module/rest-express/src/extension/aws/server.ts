// @file-if aws-serverless-express
import * as http from 'http';
import type * as lambda from 'aws-lambda';

import * as awsServerlessExpress from 'aws-serverless-express';

import { Injectable } from '@travetto/di';
import { RestServer } from '@travetto/rest/src/server/base';
import { RestLambdaSym } from '@travetto/rest/src/internal/lambda';
import { ConfigManager } from '@travetto/config';

import { ExpressRestServer } from '../../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable({
  qualifier: RestLambdaSym,
  target: RestServer
})
export class AwsLambdaRestServer extends ExpressRestServer {

  private server: http.Server;

  /**
   * Handler method for the proxy
   */
  public handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return awsServerlessExpress.proxy(this.server, event, context, 'PROMISE').promise;
  }

  createRaw() {
    const ret = super.createRaw();
    const config = ConfigManager.get('rest.aws');
    this.server = awsServerlessExpress.createServer(ret, undefined, config.binaryMimeTypes ?? []);
    return ret;
  }

  async listen() {
    return this.server;
  }
}