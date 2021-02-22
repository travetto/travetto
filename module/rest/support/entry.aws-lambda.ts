import type * as lambda from 'aws-lambda';
import type { AwsLambdaRestApplication } from '../src/extension/aws-lambda';

let inst: AwsLambdaRestApplication;
export async function handler(event: lambda.APIGatewayProxyEvent, context: lambda.Context) {
  if (!inst) {
    require('@travetto/boot/register');

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    const { DependencyRegistry } = await import('@travetto/di');
    await DependencyRegistry.init();

    const { AwsLambdaRestApplication: App, AwsLambdaSym } = await import('@travetto/rest/src/extension/aws-lambda');

    inst = await DependencyRegistry.getInstance(App, AwsLambdaSym);
    await inst.run();
  }
  return inst.handle(event, context);
}