import { Injectable, Inject } from '@travetto/di';

import { WebChainedContext } from '../types.ts';
import { WebResponse } from '../types/response.ts';
import { WebInterceptor } from '../types/interceptor.ts';
import { WebInterceptorCategory } from '../types/core.ts';
import { WebAsyncContext } from '../context.ts';

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'global';

  @Inject()
  context: WebAsyncContext;

  filter(ctx: WebChainedContext): Promise<WebResponse> {
    return this.context.withContext(ctx.req, ctx.next);
  }
}