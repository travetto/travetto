import { Injectable, Inject } from '@travetto/di';

import { HttpChainedContext } from '../types.ts';
import { HttpResponse } from '../types/response.ts';
import { HttpInterceptor, HttpInterceptorCategory } from '../types/interceptor.ts';
import { WebContext } from '../context.ts';

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'global';

  @Inject()
  context: WebContext;

  filter(ctx: HttpChainedContext): Promise<HttpResponse> {
    return this.context.withContext(ctx, ctx.next);
  }
}