import type * as lambda from 'aws-lambda';

import { Inject, Injectable } from '@travetto/di';

import { RestApplication } from '../application/rest';
import { RestServer } from '../application/server';

export const AwsLambdaSym = Symbol.for('@trv:rest/aws-lambda');

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

@Injectable(AwsLambdaSym)
export class AwsLambdaRestApplication extends RestApplication implements AwsLambdaHandler {
  constructor(@Inject(AwsLambdaSym) private lambdaServer: AwsLambdaRestServer) {
    super();
    this.server = lambdaServer;
  }

  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return this.lambdaServer.handle(event, context);
  }
}