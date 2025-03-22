import { Injectable } from '@travetto/di';
import { Class } from '@travetto/runtime';

import { HttpInterceptor, HttpInterceptorCategory } from './types';
import { HttpContext } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { LoggingInterceptor } from './logging';

@Injectable()
export class RespondInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async intercept(ctx: HttpContext): Promise<void> {
    let value;
    try {
      value = await ctx.next();
    } catch (err) {
      value = err;
    }

    if (!ctx.res.headersSent) {
      const payload = HttpPayloadUtil.ensureSerialized(ctx.req, ctx.res, value);

      // Handle final ejection if specified
      await ctx.res.respond(payload);
    }
  }
}