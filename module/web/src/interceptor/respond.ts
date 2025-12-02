import { Injectable } from '@travetto/di';

import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';

import { WebChainedContext } from '../types/filter.ts';
import { LoggingInterceptor } from './logging.ts';
import { WebCommonUtil } from '../util/common.ts';

@Injectable()
export class RespondInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    let response;
    try {
      response = await ctx.next();
    } catch (err) {
      response = WebCommonUtil.catchResponse(err);
    }
    return response;
  }
}