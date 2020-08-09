// @file-if aws-lambda-fastify
import type * as lambda from 'aws-lambda';
import { FastifyInstance } from 'fastify';

import { AppUtil } from '@travetto/app';
import { Injectable } from '@travetto/di';
import { RestServer } from '@travetto/rest/src/server/server';
import { ConfigManager } from '@travetto/config';

import { FastifyRestServer } from '../../server';


const awsLambdaFastify = require('aws-lambda-fastify') as (
  (app: FastifyInstance, binaryMimeTypes?: string[])
    => (event: lambda.APIGatewayProxyEvent, context: lambda.Context) => void // eslint-disable-line
);

/**
 * Aws Lambda Rest Server
 */
@Injectable({
  qualifier: Symbol.for('@trv:rest/aws-lambda'),
  target: RestServer
})
export class AwsLambdaRestServer extends FastifyRestServer {

  /**
   * Handler method for the proxy, will get initialized on first request
   */
  public handle: (event: lambda.APIGatewayProxyEvent, context: lambda.Context) => void;

  /**
   * Create app
   */
  async createRaw() {
    const ret = await super.createRaw();
    const config = ConfigManager.get('rest.aws');
    const mimeTypes = config.binaryMimeTypes ?? config.defaultBinaryMimeTypes ?? [];
    this.handle = awsLambdaFastify(ret, mimeTypes);
    return ret;
  }

  /**
   * Listen for the application to close, don't wait up
   */
  async listen() {
    return {
      ...AppUtil.listenToCloseable(this.raw.server),
      async wait() { } // Don't wait
    };
  }
}