// @file-if @travetto/rest
import { GetCacheInterceptor, RestInterceptor, Request, Response, RouteConfig } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { ConfigManager } from '@travetto/config';

import { AsyncContext } from '../service';

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor implements RestInterceptor {

  after = [GetCacheInterceptor];

  @Inject()
  context: AsyncContext;

  applies(route: RouteConfig): boolean {
    return !ConfigManager.get('rest.context').disabled;
  }

  async intercept(req: Request, res: Response, next: () => Promise<void>) {
    return this.context.run(next);
  }
}