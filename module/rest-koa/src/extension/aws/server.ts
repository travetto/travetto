// @file-if aws-serverless-express
import * as http from 'http';
import type * as lambda from 'aws-lambda';

import * as awsServerlessExpress from 'aws-serverless-express';

import { AppUtil } from '@travetto/app';
import { Injectable } from '@travetto/di';
import { RestServer } from '@travetto/rest/src/server/server';
import { ConfigManager } from '@travetto/config';

import { KoaRestServer } from '../../server';

/**
 * Aws Lambda Rest Server
 */
@Injectable({
  qualifier: Symbol.for('@trv:rest/aws-lambda'),
  target: RestServer
})
export class AwsLambdaRestServer extends KoaRestServer {

  private server: http.Server;

  /**
   * Handler method for the proxy
   */
  public handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return awsServerlessExpress.proxy(this.server, event, context, 'PROMISE').promise;
  }

  /**
   * Create app
   */
  createRaw() {
    const ret = super.createRaw();
    const config = ConfigManager.get('rest.aws');
    const mimeTypes = config.binaryMimeTypes ?? config.defaultBinaryMimeTypes ?? [];
    this.server = awsServerlessExpress.createServer(ret.callback(), undefined, mimeTypes);
    return ret;
  }

  /**
   * Listen for the application to close, don't wait up
   */
  async listen() {
    return {
      ...AppUtil.listenToCloseable(this.server),
      async wait() { } // Don't wait
    };
  }
}