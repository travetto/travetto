import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/runtime';

import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { HttpChainedContext, WebInternal } from '../types.ts';
import { LoggingInterceptor } from './logging.ts';
import { HttpPayload } from '../response/payload.ts';

@Injectable()
export class RespondInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';
  dependsOn = [LoggingInterceptor];

  async filter(ctx: HttpChainedContext): Promise<HttpPayload> {
    let value;
    try {
      value = await ctx.next();
    } catch (err) {
      value = await HttpPayload.fromError(err instanceof Error ? err : AppError.fromBasic(err));
    }
    await ctx.req[WebInternal].contact.respond(value);
    return value;
  }
}