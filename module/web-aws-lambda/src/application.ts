import type lambda from 'aws-lambda';

import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { ConfigurationService } from '@travetto/config';
import { WebApplication, WebDispatcher, WebApplicationHandle } from '@travetto/web';

import { AwsLambdaWebUtil } from './util.ts';

@Injectable()
export class AwsLambdaWebApplication implements WebApplication {

  @Inject()
  router: WebDispatcher;

  async run(): Promise<WebApplicationHandle> {
    await DependencyRegistry.getInstance(ConfigurationService).then(v => v.initBanner());
    return { close(): void { }, on(): void { } };
  }

  async handle(event: lambda.APIGatewayProxyEvent, context: lambda.Context): Promise<lambda.APIGatewayProxyResult> {
    context.callbackWaitsForEmptyEventLoop = false;
    const req = AwsLambdaWebUtil.toWebRequest(event);
    const res = await this.router.dispatch({ req });
    return AwsLambdaWebUtil.toLambdaResult(res, event.isBase64Encoded);
  }
}