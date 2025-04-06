import { Injectable } from '@travetto/di';

import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebResponse } from '../types/response.ts';

import { WebChainedContext } from '../types.ts';
import { LoggingInterceptor } from './logging.ts';

@Injectable()
export class RespondInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: WebChainedContext): Promise<WebResponse> {
    let res;
    try {
      res = await ctx.next();
    } catch (err) {
      res = WebResponse.fromCatch(err);
    }
    return res;
  }
}