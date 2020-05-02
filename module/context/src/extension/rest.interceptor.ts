// @file-if @travetto/rest
import { GetCacheInterceptor, RestInterceptor, Request, Response, RouteConfig } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { ConfigSource } from '@travetto/config';

import { AsyncContext } from '../service';

/**
 * Enables access to contextual data when running in a rest application
 */
@Injectable()
export class AsyncContextInterceptor extends RestInterceptor {

  after = GetCacheInterceptor;

  @Inject()
  context: AsyncContext;

  public applies?(route: RouteConfig): boolean {
    return !ConfigSource.get('rest.context').disabled;
  }

  async intercept(req: Request, res: Response, next: () => Promise<void>) {
    return this.context.run(next);
  }
}