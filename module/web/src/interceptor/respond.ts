import { Injectable } from '@travetto/di';

import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebChainedContext } from '../types/filter.ts';
import type { WebInterceptor } from '../types/interceptor.ts';
import type { WebResponse } from '../types/response.ts';
import { WebCommonUtil } from '../util/common.ts';
import { LoggingInterceptor } from './logging.ts';

@Injectable()
export class RespondInterceptor implements WebInterceptor {
  category: WebInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    let response: WebResponse;
    try {
      response = await ctx.next();
    } catch (error) {
      response = WebCommonUtil.catchResponse(error);
    }
    return response;
  }
}
