import { Class } from '@travetto/base';
import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import { Request, Response, CookiesInterceptor, RestInterceptor, ManagedConfig, ManagedInterceptor } from '@travetto/rest';

import { SessionService } from './service';

@Config('rest.session')
export class RestSessionConfig extends ManagedConfig { }

/**
 * Loads session, and provides ability to create session as needed.
 *
 * This needs to run after the auth interceptor due to the desire to use
 * the request's auth details as potential input into the session id.
 *
 * NOTE: This is asymmetric with the writing process due to rest-auth's behavior.
 */
@Injectable()
@ManagedInterceptor()
export class SessionReadInterceptor implements RestInterceptor {

  after: Class<RestInterceptor>[] = [
    CookiesInterceptor,
  ];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  async postConstruct(): Promise<void> {
    try {
      const { AuthInterceptor } = await import('@travetto/auth-rest');
      this.after.push(AuthInterceptor);
    } catch { }
  }

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
@ManagedInterceptor()
export class SessionWriteInterceptor implements RestInterceptor {

  after = [CookiesInterceptor];
  before: Class<RestInterceptor>[] = [];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  async postConstruct(): Promise<void> {
    try {
      const { AuthInterceptor } = await import('@travetto/auth-rest');
      this.before.push(AuthInterceptor);
    } catch { }
  }

  async intercept(req: Request, res: Response, next: () => Promise<unknown>): Promise<unknown> {
    try {
      Object.defineProperty(req, 'session', { get: () => this.service.ensureCreated(req) });
      return await next();
    } finally {
      await this.service.writeResponse(req, res);
    }
  }
}