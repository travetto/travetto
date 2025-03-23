import { Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from './types';
import { HttpChainedContext } from '../types';
import { HttpPayloadUtil } from '../util/payload';
import { LoggingInterceptor } from './logging';

@Injectable()
export class RespondInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: HttpChainedContext): Promise<unknown> {
    let value;
    try {
      value = await ctx.next();
    } catch (err) {
      value = err;
    }

    if (!ctx.res.headersSent) {
      const payload = HttpPayloadUtil.ensureSerialized(ctx, value);
      return await ctx.res.respond(payload);
    }
  }
}