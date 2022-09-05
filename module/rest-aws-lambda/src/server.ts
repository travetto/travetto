import { Inject, Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { RestServer, RestApplication } from '@travetto/rest';

import { LambdaAPIGatewayProxyEvent, LambdaContext, LambdaAPIGatewayProxyResult } from './types';

export const AwsLambdaⲐ = Symbol.for('@trv:rest-aws-lambda/entry');


/**
 * Main contract for lambda based applications
 */
export interface AwsLambdaHandler {
  /**
   * Handles lambda proxy event
   */
  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult>;
}

export class AwsLambdaRestServerTarget { }

/**
 * Interface for lambda rest servers
 * @concrete .:AwsLambdaRestServerTarget
 */
export interface AwsLambdaRestServer extends RestServer, AwsLambdaHandler { }

@Config('rest.aws')
export class RestAwsConfig {
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
export class AwsLambdaRestApplication extends RestApplication implements AwsLambdaHandler {
  #lambdaServer: AwsLambdaRestServer;

  constructor(@Inject(AwsLambdaⲐ) lambdaServer: AwsLambdaRestServer) {
    super();
    this.server = lambdaServer;
    this.#lambdaServer = lambdaServer;
  }

  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult> {
    return this.#lambdaServer.handle(event, context);
  }
}