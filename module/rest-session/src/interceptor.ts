import { Class, RuntimeIndex } from '@travetto/runtime';
import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import {
  CookiesInterceptor, RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterNext,
  FilterReturn, SerializeInterceptor, AsyncContextInterceptor
} from '@travetto/rest';
import { AuthContext } from '@travetto/auth';

import { SessionService } from './service';

@Config('rest.session')
export class RestSessionConfig extends ManagedInterceptorConfig { }

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

  dependsOn: Class<RestInterceptor>[] = [CookiesInterceptor, SerializeInterceptor, AsyncContextInterceptor];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  @Inject()
  authContext: AuthContext;

  async postConstruct(): Promise<void> {
    if (RuntimeIndex.hasModule('@travetto/auth-rest')) {
      const { AuthReadWriteInterceptor } = await import('@travetto/auth-rest');
      this.dependsOn.push(AuthReadWriteInterceptor);
    }
  }

  async intercept({ req }: FilterContext, next: FilterNext): Promise<unknown> {
    // Use auth id if found, but auth is not required
    const principal = this.authContext.principal;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await this.service.readRequest(req, principal?.details?.sessionId as string ?? principal?.id);
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

  dependsOn = [CookiesInterceptor, SerializeInterceptor];

  runsBefore: Class<RestInterceptor>[] = [];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  async postConstruct(): Promise<void> {
    if (RuntimeIndex.hasModule('@travetto/auth-rest')) {
      const { AuthReadWriteInterceptor } = await import('@travetto/auth-rest');
      this.runsBefore.push(AuthReadWriteInterceptor);
    }
  }

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<FilterReturn> {
    try {
      Object.defineProperty(req, 'session', { get: () => this.service.ensureCreated() });
      return await next();
    } finally {
      await this.service.writeResponse(res);
    }
  }
}