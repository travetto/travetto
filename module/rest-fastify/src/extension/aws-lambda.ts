// @file-if @fastify/aws-lambda
import { FastifyInstance } from 'fastify';

import { Inject, Injectable } from '@travetto/di';
import { AwsLambdaRestServer, AwsLambdaⲐ, RestAwsConfig } from '@travetto/rest/src/extension/aws-lambda';

import { FastifyRestServer } from '../server';

// TODO: Get proper typings
// eslint-disable-next-line travetto/import-order
const awsLambdaFastify = require('@fastify/aws-lambda') as (
  (app: FastifyInstance, binaryMimeTypes?: string[]) => AwsLambdaRestServer['handle']  // eslint-disable-line
);

/**
 * Aws Lambda Rest Server
 */
@Injectable(AwsLambdaⲐ)
export class AwsLambdaFastifyRestServer extends FastifyRestServer implements AwsLambdaRestServer {

  @Inject()
  awsConfig: RestAwsConfig;

  /**
   * Handler method for the proxy, will get initialized on first request
   */
  handle: AwsLambdaRestServer['handle'];

  override async init() {
    const ret = await super.init();
    this.handle = awsLambdaFastify(ret, this.awsConfig.binaryMimeTypes ?? []);
    return ret;
  }

  override async listen() {
    this.listening = true;
    return {
      close: this.raw.close.bind(this.raw),
      on: this.raw.server.on.bind(this.raw.server)
    };
  }
}