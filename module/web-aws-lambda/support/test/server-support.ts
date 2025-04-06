import type lambda from 'aws-lambda';

import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { WebRequest, WebServerHandle, CookieConfig, WebApplication, WebResponse } from '@travetto/web';
import { asFull, castTo } from '@travetto/runtime';

import { WebServerSupport } from '@travetto/web/support/test/types.ts';

import { AwsLambdaWebServer } from '../../src/server.ts';
import { AwsLambdaWebUtil } from '../../src/util.ts';

/**
 * AWS Lambda support for invoking directly
 */
export class AwsLambdaWebServerSupport implements WebServerSupport {

  #lambda: WebApplication<AwsLambdaWebServer>;

  async init(qualifier?: symbol): Promise<WebServerHandle> {
    await RootRegistry.init();

    Object.assign(
      await DependencyRegistry.getInstance(CookieConfig),
      { active: true, secure: false, signed: false }
    );

    this.#lambda = await DependencyRegistry.getInstance<WebApplication<AwsLambdaWebServer>>(WebApplication, qualifier);
    return await this.#lambda.run();
  }

  async execute(req: WebRequest): Promise<WebResponse> {
    const res = (await castTo<AwsLambdaWebServer>(this.#lambda.server).handle(
      AwsLambdaWebUtil.toLambdaEvent(req), asFull<lambda.Context>({}))
    );
    return AwsLambdaWebUtil.toWebResponse(res);
  }
}