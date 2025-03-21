import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { HttpContext, WebFilterNext } from '../types.ts';
import { ManagedInterceptorConfig, HttpInterceptor, HttpInterceptorCategory } from './types.ts';
import { WebContext } from '../context.ts';

@Config('web.context')
class AsyncContextConfig extends ManagedInterceptorConfig { }

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'global';

  @Inject()
  context: WebContext;

  @Inject()
  config: AsyncContextConfig;

  intercept(ctx: HttpContext, next: WebFilterNext): Promise<unknown> {
    return this.context.withContext(ctx, next);
  }
}