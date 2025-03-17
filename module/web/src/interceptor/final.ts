import { Injectable } from '@travetto/di';

import { HttpInterceptor } from './types';
import { LoggingInterceptor } from './logging';
import { FilterContext, FilterNext, WebInternal } from '../types';

@Injectable()
export class FinalSendInterceptor implements HttpInterceptor {
  runsBefore = [LoggingInterceptor];

  async intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      return await next();
    } finally {
      if (!ctx.res.headersSent) {
        // Handle final ejection if specified
        await ctx.res[WebInternal].send?.();
      }
    }
  }
}