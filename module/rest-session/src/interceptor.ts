import { Class, RuntimeIndex } from '@travetto/runtime';
import { Config } from '@travetto/config';
import { Injectable, Inject, DependencyRegistry } from '@travetto/di';
import {
  CookiesInterceptor, RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterNext,
  FilterReturn, SerializeInterceptor, AsyncContextInterceptor
} from '@travetto/rest';

import { SessionService } from './service';

@Config('rest.session')
export class RestSessionConfig extends ManagedInterceptorConfig {
  /**
   * Should the session be signed
   */
  sign = true;
  /**
   * Auth output key name
   */
  keyName = 'trv_sid';
  /**
   * Location for auth
   */
  transport: 'cookie' | 'header' = 'cookie';
}

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

  async postConstruct(): Promise<void> {
    if (RuntimeIndex.hasModule('@travetto/auth-rest')) {
      const { AuthReadWriteInterceptor } = await import('@travetto/auth-rest');
      this.dependsOn.push(AuthReadWriteInterceptor);
    }
  }

  async intercept({ req }: FilterContext, next: FilterNext): Promise<unknown> {
    Object.defineProperty(req, 'session', { get: () => this.service.get() });

    await this.service.load(async () => {
      let sessionId: string | undefined;
      // Use auth id if found, but auth is not required
      if (RuntimeIndex.hasModule('@travetto/auth')) {
        sessionId = await import('@travetto/auth')
          .then(v => DependencyRegistry.getInstance(v.AuthContext))
          .then(s => s.principal?.details.sessionId ?? s.principal?.id)
          .catch(() => undefined);
      }
      return sessionId ??
        (this.config.transport === 'cookie' ?
          req.cookies.get(this.config.keyName) :
          req.headerFirst(this.config.keyName));
    });
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

  async intercept({ res }: FilterContext, next: FilterNext): Promise<FilterReturn> {
    try {
      return await next();
    } finally {
      const value = await this.service.persist();
      if (this.config.transport === 'cookie' && value !== undefined) {
        res.cookies.set(this.config.keyName, value?.id ?? null, {
          expires: value?.expiresAt ?? new Date(),
          maxAge: undefined,
          signed: this.config.sign
        });
      } else if (this.config.transport === 'header' && value?.action === 'create') {
        res.setHeader(this.config.keyName, value.id);
      }
    }
  }
}