import { Injectable, Inject } from '@travetto/di';
import { CookiesInterceptor, RestInterceptor, Request, Response } from '@travetto/rest';

import { RestSessionService } from './service';

/**
 * Tracks the user activity and loads/stores the session for a given
 * request/response depending on session existence and state change
 */
@Injectable()
export class SessionInterceptor extends RestInterceptor {

  after = [CookiesInterceptor];

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