import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { FilterContext, FilterNext } from '../types.ts';
import { ManagedInterceptorConfig, HttpInterceptor } from './types.ts';
import { WebContext } from '../context.ts';
import { InterceptorGroup } from './groups.ts';

@Config('web.context')
class AsyncContextConfig extends ManagedInterceptorConfig { }

/**
 * Enables access to contextual data when running in a web application
 */
@Injectable()
export class AsyncContextInterceptor implements HttpInterceptor {

  runsBefore = [InterceptorGroup.Application];

  @Inject()
  context: WebContext;

  @Inject()
  config: AsyncContextConfig;

  intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    return this.context.withContext(ctx, next);
  }
}