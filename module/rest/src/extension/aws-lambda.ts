// @file-if aws-lambda
import type * as lambda from 'aws-lambda';
import { Inject, Injectable } from '@travetto/di';
import { RestApplication } from '../application/rest';
import { RestServer } from '../application/server';

export interface LambdaResponse {
  statusCode: number;
  body: string;
  headers: {};
}

/**
 * Main contract for lambda based applications
 * @concrete .:AwsLambdaHandlerTarget
 */
export interface AwsLambdaHandler {
  /**
   * Handles lambda proxy event
   */
  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<LambdaResponse | void> | LambdaResponse | void;
}

export class AwsLambdaRestServerTarget { }

/**
 * Interface for lambda rest servers
 * @concrete .:AwsLambdaRestServerTarget
 */
export interface AwsLambdaRestServer extends RestServer, AwsLambdaHandler { }

@Injectable()
export class RestLambdaApplication extends RestApplication implements AwsLambdaHandler {
  constructor(@Inject() server: AwsLambdaRestServer) {
    super();
    this.server = server;
  }

  handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
    return (this.server as AwsLambdaRestServer).handle(event, context);
  }
}