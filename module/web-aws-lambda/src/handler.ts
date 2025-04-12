import type lambda from 'aws-lambda';

import { Runtime, ConsoleManager } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { ConfigurationService } from '@travetto/config';
import { StandardWebRouter, WebConfig, WebRequest } from '@travetto/web';

import { AwsLambdaWebUtil } from './util.ts';

@Injectable()
export class AwsLambdaWebHandler {

  static inst: AwsLambdaWebHandler;

  static entryPoint(): (event: lambda.APIGatewayProxyEvent, context: lambda.Context) => Promise<lambda.APIGatewayProxyResult> {
    ConsoleManager.debug(Runtime.debug);

    return async (event, context) => {
      if (!this.inst) {
        await RootRegistry.init();
        await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
        this.inst = await DependencyRegistry.getInstance(AwsLambdaWebHandler);
      }
      return this.inst.handle(event, context);
    };
  }

  @Inject()
  router: StandardWebRouter;

  @Inject()
  config: WebConfig;

  async handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
    context.callbackWaitsForEmptyEventLoop = false;
    const req = WebRequest.secure(AwsLambdaWebUtil.toWebRequest(event), this.config.trustProxy);
    const res = await this.router.dispatch({ req });
    return AwsLambdaWebUtil.toLambdaResult(res, event.isBase64Encoded);
  }
}