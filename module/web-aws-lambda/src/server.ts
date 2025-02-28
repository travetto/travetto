import { Inject, Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { WebServer, WebApplication } from '@travetto/web';

import { LambdaAPIGatewayProxyEvent, LambdaContext, LambdaAPIGatewayProxyResult } from './types';

export const AwsLambdaSymbol = Symbol.for('@travetto/web-aws-lambda:entry');

/**
 * Main contract for lambda based applications
 */
export interface AwsLambdaHandler {
  /**
   * Handles lambda proxy event
   */
  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult>;
}

export type AwsLambdaHandle = AwsLambdaHandler['handle'];

/**
 * Interface for lambda web servers
 * @concrete
 */
export interface AwsLambdaWebServer extends WebServer, AwsLambdaHandler { }

@Config('web.aws')
export class WebAwsConfig {
  binaryMimeTypes?: string[];

  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (this.binaryMimeTypes) {
      out.binarySettings = { contentTypes: this.binaryMimeTypes };
    }
    return out;
  }
}

@Injectable()
export class AwsLambdaWebApplication extends WebApplication implements AwsLambdaHandler {
  #lambdaServer: AwsLambdaWebServer;

  constructor(@Inject(AwsLambdaSymbol) lambdaServer: AwsLambdaWebServer) {
    super();
    this.server = lambdaServer;
    this.#lambdaServer = lambdaServer;
  }

  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult> {
    return this.#lambdaServer.handle(event, context);
  }
}