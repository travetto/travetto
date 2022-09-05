import type { LambdaAPIGatewayProxyEvent, LambdaContext, LambdaAPIGatewayProxyResult } from './types';
import type { AwsLambdaHandler } from './server';

async function buildApp(): Promise<{
  handle(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult>;
}> {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  await DependencyRegistry.init();

  const { AwsLambdaRestApplication } = await import('./server');

  const app = await DependencyRegistry.getInstance(AwsLambdaRestApplication);
  await app.run();
  return app;
}

let inst: AwsLambdaHandler;
export async function handler(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult> {
  context.callbackWaitsForEmptyEventLoop = false;
  return (inst ??= await buildApp()).handle(event, context);
}