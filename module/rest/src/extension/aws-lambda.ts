// @file-if aws-lambda
import type * as lambda from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { RestApplication } from '../application/rest';
import { RestServer } from '../application/server';

export const AwsLambdaⲐ = Symbol.for('@trv:rest/aws-lambda');

/**
 * Main contract for lambda based applications
 */
export interface AwsLambdaHandler {
  /**
   * Handles lambda proxy event
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult>;
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

  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
    return this.#lambdaServer.handle(event, context);
  }
}