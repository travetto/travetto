import { Injectable, Inject } from '@travetto/di';
import { RestInterceptor, Request, Response } from '@travetto/rest';

import { RestSessionService } from './services';

@Injectable()
export class SessionInterceptor extends RestInterceptor {

  @Inject()
  service: RestSessionService;

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    try {
      this.service.configure(req);
      await this.service.loadFromExternal(req);
      return await next();
    } finally {
      await this.service.storeToExternal(req, res);
    }
  }
}