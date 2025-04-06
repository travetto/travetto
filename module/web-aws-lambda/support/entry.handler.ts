// @trv-no-transform
import type lambda from 'aws-lambda';
import type { AwsLambdaWebApplication } from '../src/application.ts';

async function buildApp(): Promise<AwsLambdaWebApplication> {
  const { Runtime, ConsoleManager } = await import('@travetto/runtime');
  ConsoleManager.debug(Runtime.debug);

  const { RootRegistry } = await import('@travetto/registry');
  await RootRegistry.init();

  const { DependencyRegistry } = await import('@travetto/di');

  const web = await import('../src/application.ts');
  const app = await DependencyRegistry.getInstance(web.AwsLambdaWebApplication);
  await app.run();
  return app;
}

let inst: AwsLambdaWebApplication;
export async function handler(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
  return (inst ??= await buildApp()).handle(event, context);
}