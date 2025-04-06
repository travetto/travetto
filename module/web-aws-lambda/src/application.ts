import type lambda from 'aws-lambda';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { ConfigurationService } from '@travetto/config';
import { WebApplication, WebRouter, WebServerHandle } from '@travetto/web';

import { AwsLambdaWebUtil } from './util.ts';

@Injectable()
export class AwsLambdaWebApplication implements WebApplication {

  @Inject()
  router: WebRouter;

  async run(): Promise<WebServerHandle> {
    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
    return { close(): void { }, on(): void { } };
  }

  async handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
    context.callbackWaitsForEmptyEventLoop = false;
    const req = AwsLambdaWebUtil.toWebRequest(event);
    const res = await this.router.execute({ req });
    return AwsLambdaWebUtil.toLambdaResult(res, event.isBase64Encoded);
  }
}