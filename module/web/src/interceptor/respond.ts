import { Injectable } from '@travetto/di';

import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { HttpResponse } from '../types/response.ts';

import { HttpChainedContext } from '../types.ts';
import { LoggingInterceptor } from './logging.ts';

@Injectable()
export class RespondInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: HttpChainedContext): Promise<HttpResponse> {
    let res;
    try {
      res = await ctx.next();
    } catch (err) {
      res = HttpResponse.fromCatch(err);
    }
    await ctx.req.respond(res);
    return res;
  }
}