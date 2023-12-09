
import type { LambdaAPIGatewayProxyEvent, LambdaContext, LambdaAPIGatewayProxyResult } from '../src/types';
import type { AwsLambdaHandler } from '../src/server';

type HandleFunction = (event: LambdaAPIGatewayProxyEvent, context: LambdaContext) => Promise<LambdaAPIGatewayProxyResult>;

async function buildApp(): Promise<{ handle: HandleFunction }> {
  const { Env, ConsoleManager } = await import('@travetto/base');
  await ConsoleManager.register({ debug: Env.debug });

  const { RootRegistry } = await import('@travetto/registry');
  await RootRegistry.init();

  const { DependencyRegistry } = await import('@travetto/di');
  const { AwsLambdaRestApplication } = await import('../src/server.js');
  const app = await DependencyRegistry.getInstance(AwsLambdaRestApplication);
  await app.run();
  return app;
}

let inst: AwsLambdaHandler;
export async function handler(event: LambdaAPIGatewayProxyEvent, context: LambdaContext): Promise<LambdaAPIGatewayProxyResult> {
  context.callbackWaitsForEmptyEventLoop = false;
  return (inst ??= await buildApp()).handle(event, context);
}