import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { init } from '@travetto/base/support/init';

import type { LambdaAPIGatewayProxyEvent, LambdaContext, LambdaAPIGatewayProxyResult } from '../src/types';
import { AwsLambdaRestApplication, AwsLambdaHandler } from '../src/server';

async function buildApp(): Promise<{
  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult>;
}> {
  init();
  await RootRegistry.init();

  const app = await DependencyRegistry.getInstance(AwsLambdaRestApplication);
  await app.run();
  return app;
}

let inst: AwsLambdaHandler;
export async function handler(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult> {
  context.callbackWaitsForEmptyEventLoop = false;
  return (inst ??= await buildApp()).handle(event, context);
}