import * as alf from '@fastify/aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { ServerHandle } from '@travetto/rest/src/types';
import { AwsLambdaRestServer, AwsLambdaⲐ, RestAwsConfig } from '@travetto/rest-aws-lambda';
import { FastifyRestServer } from '@travetto/rest-fastify';


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
    // @ts-expect-error
    this.handle = alf(ret, this.awsConfig);
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