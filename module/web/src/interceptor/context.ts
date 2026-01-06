import { Injectable, Inject } from '@travetto/di';

import type { WebChainedContext } from '../types/filter.ts';
import type { WebResponse } from '../types/response.ts';
import type { WebInterceptor } from '../types/interceptor.ts';
import type { WebInterceptorCategory } from '../types/core.ts';
import type { WebAsyncContext } from '../context.ts';

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'global';

  @Inject()
  context: WebAsyncContext;

  filter({ request, next }: WebChainedContext): Promise<WebResponse> {
    return this.context.withContext(request, next);
  }
}