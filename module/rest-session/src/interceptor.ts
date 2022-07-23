import { AuthInterceptor } from '@travetto/auth-rest'; // @line-if @travetto/auth-rest
import { Injectable, Inject } from '@travetto/di';
import { Request, Response, CookiesInterceptor, RestInterceptor } from '@travetto/rest';

import { SessionService } from './service';

/**
 * Loads session, and provides ability to create session as needed.
 *
 * This needs to run after the auth interceptor due to the desire to use
 * the request's auth details as potential input into the session id.
 *
 * NOTE: This is asymmetric with the writing process due to rest-auth's behavior.
 */
@Injectable()
export class SessionReadInterceptor implements RestInterceptor {

  after = [
    CookiesInterceptor,
    AuthInterceptor // @line-if @travetto/auth-rest
  ];

  @Inject()
  service: SessionService;

  async intercept(req: Request, res: Response, next: () => Promise<unknown>): Promise<unknown> {
    // Use auth id if found, but auth is not required
    await this.service.readRequest(req, req.auth?.details?.sessionId ?? req.auth?.id);
    return await next();
  }
}

/**
 * Stores session.
 *
 * The write needs to occur after any potential changes to the session, which could
 * be impacted by the authentication flow, specifically principal expiry.
 *
 */
@Injectable()
export class SessionWriteInterceptor implements RestInterceptor {

  after = [CookiesInterceptor];
  before = [AuthInterceptor]; // @line-if @travetto/auth-rest

  @Inject()
  service: SessionService;

  async intercept(req: Request, res: Response, next: () => Promise<unknown>): Promise<unknown> {
    try {
      Object.defineProperty(req, 'session', { get: () => this.service.ensureCreated(req) });
      return await next();
    } finally {
      await this.service.writeResponse(req, res);
    }
  }
}