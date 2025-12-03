import type lambda from 'aws-lambda';

import { Runtime, ConsoleManager } from '@travetto/runtime';
import { DependencyRegistryIndex, Inject, Injectable } from '@travetto/di';
import { Registry } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';
import { StandardWebRouter } from '@travetto/web';

import { AwsLambdaWebUtil } from './util.ts';

@Injectable()
export class AwsLambdaWebHandler {

  static inst: AwsLambdaWebHandler;

  static entryPoint(): (event: lambda.APIGatewayProxyEvent, context: lambda.Context) => Promise<lambda.APIGatewayProxyResult> {
    ConsoleManager.debug(Runtime.debug);

    return async (event, context) => {
      if (!this.inst) {
        await Registry.init();
        await DependencyRegistryIndex.getInstance(ConfigurationService).then(config => config.initBanner());
        this.inst = await DependencyRegistryIndex.getInstance(AwsLambdaWebHandler);
      }
      return this.inst.handle(event, context);
    };
  }

  @Inject()
  router: StandardWebRouter;

  async handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
    context.callbackWaitsForEmptyEventLoop = false;
    const request = AwsLambdaWebUtil.toWebRequest(event);
    const response = await this.router.dispatch({ request });
    return AwsLambdaWebUtil.toLambdaResult(response, event.isBase64Encoded);
  }
}