// @file-if aws-lambda-fastify
import type * as lambda from 'aws-lambda';
import { FastifyInstance } from 'fastify';

import { Injectable } from '@travetto/di';
import { ConfigManager } from '@travetto/config';
import { RestServerTarget } from '@travetto/rest/src/internal/server';
import { RestLambdaSym } from '@travetto/rest/src/internal/lambda';

import { FastifyRestServer } from '../../server';

// TODO: Get proper typings
const awsLambdaFastify = require('aws-lambda-fastify') as (
  (app: FastifyInstance, binaryMimeTypes?: string[])
    => (event: lambda.APIGatewayProxyEvent, context: lambda.Context) => void // eslint-disable-line
);

/**
 * Aws Lambda Rest Server
 */
@Injectable({
  qualifier: RestLambdaSym,
  target: RestServerTarget
})
export class AwsLambdaFastifyRestServer extends FastifyRestServer {

  /**
   * Handler method for the proxy, will get initialized on first request
   */
  public handle: (event: lambda.APIGatewayProxyEvent, context: lambda.Context) => void;

  async init() {
    const ret = await super.init();
    const config = ConfigManager.get('rest.aws');
    this.handle = awsLambdaFastify(ret, config.binaryMimeTypes as string[] ?? []);
    return ret;
  }

  async listen() {
    this.listening = true;
    return {
      close: this.raw.close.bind(this.raw),
      on: this.raw.server.on.bind(this.raw.server)
    };
  }
}