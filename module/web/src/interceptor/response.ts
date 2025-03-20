import { Injectable } from '@travetto/di';

import { HttpInterceptor } from './types';
import { FilterContext, FilterNext } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { RequestInterceptorGroup } from './groups';

@Injectable()
export class ResponseInterceptor implements HttpInterceptor {
  runsBefore = [RequestInterceptorGroup];

  async intercept(ctx: FilterContext, next: FilterNext): Promise<void> {
    let value;
    try {
      value = await next();
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