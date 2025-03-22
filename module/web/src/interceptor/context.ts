import { Injectable, Inject } from '@travetto/di';

import { HttpContext, NextFunction } from '../types.ts';
import { HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { WebContext } from '../context.ts';

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'global';

  @Inject()
  context: WebContext;

  filter(ctx: HttpContext, next: NextFunction): Promise<unknown> {
    return this.context.withContext(ctx, next);
  }
}