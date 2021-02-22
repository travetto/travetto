// @file-if aws-serverless-express
import * as http from 'http';
import * as awsServerlessExpress from 'aws-serverless-express';
import type * as lambda from 'aws-lambda';

import { Injectable } from '@travetto/di';
import { ConfigManager } from '@travetto/config';

import { AwsLambdaRestServer, AwsLambdaRestServerTarget } from '@travetto/rest/src/extension/aws-lambda';

import { ExpressRestServer } from '../../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable({ target: AwsLambdaRestServerTarget })
export class AwsLambdaExpressRestServer extends ExpressRestServer implements AwsLambdaRestServer {

  private server: http.Server;

  /**
   * Handler method for the proxy
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
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