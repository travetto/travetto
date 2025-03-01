import alf from '@fastify/aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { WebServerHandle } from '@travetto/web';
import { AwsLambdaWebServer, AwsLambdaSymbol, AwsLambdaConfig } from '@travetto/web-aws-lambda';
import { FastifyWebServer } from '@travetto/web-fastify';

/**
 * Aws Lambda Web Server
 */
@Injectable(AwsLambdaSymbol)
export class AwsLambdaFastifyWebServer extends FastifyWebServer implements AwsLambdaWebServer {

  @Inject()
  awsConfig: AwsLambdaConfig;

  /**
   * Handler method for the proxy, will get initialized on first request
   */
  handle: AwsLambdaWebServer['handle'];

  override async init(): Promise<this['raw']> {
    const ret = await super.init();
    this.handle = alf(ret, this.awsConfig);
    return ret;
  }

  override async listen(): Promise<WebServerHandle> {
    this.listening = true;
    return {
      close: this.raw.close.bind(this.raw),
      on: this.raw.server.on.bind(this.raw.server)
    };
  }
}