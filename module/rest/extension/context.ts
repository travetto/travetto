import { Context } from '@travetto/context';
import { Injectable, Inject } from '@travetto/di';

import { RestInterceptor, Request, Response } from '../';

@Injectable()
export class ContextInterceptor extends RestInterceptor {

  @Inject()
  private context: Context;

  async intercept(req: Request, res: Response, next: () => Promise<void>) {
    await this.context.run(next);
  }
}
