import { Context } from '@travetto/context';
import { Injectable, Inject } from '@travetto/di';

import { GetCacheInterceptor, RestInterceptor, Request, Response } from '../';

@Injectable()
export class ContextInterceptor extends RestInterceptor {

  after = GetCacheInterceptor;

  @Inject()
  context: Context;

  async intercept(req: Request, res: Response, next: () => Promise<void>) {
    return this.context.run(next);
  }
}
