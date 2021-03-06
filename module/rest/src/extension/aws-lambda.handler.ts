import type * as lambda from 'aws-lambda';
import type { AwsLambdaHandler } from './aws-lambda';

async function buildApp() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  await DependencyRegistry.init();

  const { AwsLambdaRestApplication } = await import('./aws-lambda');

  const app = await DependencyRegistry.getInstance(AwsLambdaRestApplication);
  await app.run();
  return app;
}

let inst: AwsLambdaHandler;
export async function handler(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
  context.callbackWaitsForEmptyEventLoop = false;
  return (inst ??= await buildApp()).handle(event, context);
}