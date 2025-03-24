import { Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from './types';
import { HttpChainedContext } from '../types';
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
      return await ctx.res.respond(ctx.res.setResponse(value));
    }
  }
}