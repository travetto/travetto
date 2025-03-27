import { Injectable, Inject } from '@travetto/di';

import { HttpChainedContext } from '../types.ts';
import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { WebContext } from '../context.ts';
import { HttpPayload } from '../response/payload.ts';

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'global';

  @Inject()
  context: WebContext;

  filter(ctx: HttpChainedContext): Promise<HttpPayload> {
    return this.context.withContext(ctx, ctx.next);
  }
}