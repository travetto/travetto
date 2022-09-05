import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AsyncContext } from '@travetto/context';

import { RestInterceptor } from './types';
import { GetCacheInterceptor } from './get-cache';
import { Request, Response, RouteConfig } from '../types';

@Config('rest.context')
class RestAsyncContext {
  disabled = false;
}

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor implements RestInterceptor {

  after = [GetCacheInterceptor];

  @Inject()
  context: AsyncContext;

  @Inject()
  config: RestAsyncContext;

  applies(route: RouteConfig): boolean {
    return !this.config.disabled;
  }

  intercept(req: Request, res: Response, next: () => Promise<void>): Promise<void> {
    return this.context.run(next);
  }
}