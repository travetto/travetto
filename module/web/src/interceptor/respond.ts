import { Injectable } from '@travetto/di';

import type { WebInterceptor } from '../types/interceptor.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebResponse } from '../types/response.ts';

import type { WebChainedContext } from '../types/filter.ts';
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
    } catch (error) {
      response = WebCommonUtil.catchResponse(error);
    }
    return response;
  }
}