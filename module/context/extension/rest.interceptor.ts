import { GetCacheInterceptor, RestInterceptor, Request, Response, RouteConfig } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { ConfigSource } from '@travetto/config';

import { ContextService } from '..';

@Injectable()
export class ContextInterceptor extends RestInterceptor {

  after = GetCacheInterceptor;

  @Inject()
  context: ContextService;

  public applies?(route: RouteConfig): boolean {
    return !ConfigSource.get('rest.context').disabled;
  }

  async intercept(req: Request, res: Response, next: () => Promise<void>) {
    return this.context.run(next);
  }
}
