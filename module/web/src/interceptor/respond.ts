import { Injectable } from '@travetto/di';

import { HttpInterceptor } from './types';
import { HttpContext, WebFilterNext } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { InterceptorGroup } from './groups';

@Injectable()
export class RespondInterceptor implements HttpInterceptor {
  runsBefore = [InterceptorGroup.Request];

  async intercept(ctx: HttpContext, next: WebFilterNext): Promise<void> {
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