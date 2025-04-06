// @trv-no-transform
import type lambda from 'aws-lambda';
import type { WebApplication } from '@travetto/web';
import type { AwsLambdaWebServer } from '../src/server.ts';

async function buildApp(): Promise<WebApplication<AwsLambdaWebServer>> {
  const { Runtime, ConsoleManager } = await import('@travetto/runtime');
  ConsoleManager.debug(Runtime.debug);

  const { RootRegistry } = await import('@travetto/registry');
  await RootRegistry.init();

  const { DependencyRegistry } = await import('@travetto/di');

  const web = await import('@travetto/web');
  const app = await DependencyRegistry.getInstance(web.WebApplication<AwsLambdaWebServer>);
  await app.run();
  return app;
}

let inst: WebApplication<AwsLambdaWebServer>;
export async function handler(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
  return ((inst ??= await buildApp()).server as AwsLambdaWebServer).handle(event, context);
}