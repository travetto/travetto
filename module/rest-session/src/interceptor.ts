import { Injectable, Inject } from '@travetto/di';
import { Request, Response, CookiesInterceptor, RestInterceptor } from '@travetto/rest';

import { SessionService } from './service';

/**
 * Tracks the user activity and loads/stores the session for a given
 * request/response depending on session existence and state change
 */
@Injectable()
export class SessionInterceptor implements RestInterceptor {

  after = [CookiesInterceptor];

  @Inject()
  service: SessionService;

  async intercept(req: Request, res: Response, next: () => Promise<unknown>) {
    try {
      Object.defineProperty(req, 'session', { get: () => this.service.ensureCreated(req), });

      await this.service.readRequest(req);
      return await next();
    } finally {
      await this.service.writeResponse(req, res);
    }
  }
}