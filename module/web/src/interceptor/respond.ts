import { Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from './types';
import { HttpContext, NextFilter } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { LoggingInterceptor } from './logging';

@Injectable()
export class RespondInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: HttpContext, next: NextFilter): Promise<void> {
    let value;
    try {
      value = await next();
    } catch (err) {
      value = err;
    }

    if (!ctx.res.headersSent) {
      const payload = HttpPayloadUtil.ensureSerialized(ctx, value);

      // Handle final ejection if specified
      await ctx.res.respond(payload);
    }
  }
}