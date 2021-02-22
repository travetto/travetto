// @file-if aws-lambda-fastify
import { FastifyInstance } from 'fastify';

import { Injectable } from '@travetto/di';
import { ConfigManager } from '@travetto/config';
import { AwsLambdaRestServer, AwsLambdaSym } from '@travetto/rest/src/extension/aws-lambda';

import { FastifyRestServer } from '../../server';

// TODO: Get proper typings
const awsLambdaFastify = require('aws-lambda-fastify') as (
  (app: FastifyInstance, binaryMimeTypes?: string[]) => AwsLambdaRestServer['handle']  // eslint-disable-line
);

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaSym)
export class AwsLambdaFastifyRestServer extends FastifyRestServer implements AwsLambdaRestServer {

  /**
   * Handler method for the proxy, will get initialized on first request
   */
  handle: AwsLambdaRestServer['handle'];

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