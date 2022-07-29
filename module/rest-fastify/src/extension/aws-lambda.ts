// @file-if @fastify/aws-lambda
import type lambdaFastify from '@fastify/aws-lambda';
// eslint-disable-next-line no-duplicate-imports
import * as alf from '@fastify/aws-lambda';
// @ts-expect-error
const awsLambdaFastify: typeof lambdaFastify = alf;

import { Inject, Injectable } from '@travetto/di';
import { ServerHandle } from '@travetto/rest/src/types';
import { AwsLambdaRestServer, AwsLambdaⲐ, RestAwsConfig } from '@travetto/rest/src/extension/aws-lambda';

import { FastifyRestServer } from '../server';


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

  override async init(): Promise<this['raw']> {
    const ret = await super.init();
    this.handle = awsLambdaFastify(ret, this.awsConfig);
    return ret;
  }

  override async listen(): Promise<ServerHandle> {
    this.listening = true;
    return {
      close: this.raw.close.bind(this.raw),
      on: this.raw.server.on.bind(this.raw.server)
    };
  }
}