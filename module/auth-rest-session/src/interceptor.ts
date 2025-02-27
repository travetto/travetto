import { Class, asConcrete } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { RestInterceptor, FilterContext, FilterNext, ManagedInterceptorConfig, ParamExtractor } from '@travetto/rest';
import { SessionData, SessionService } from '@travetto/auth-session';

import { Config } from '@travetto/config';
import { AuthContextInterceptor } from '@travetto/auth-rest';

@Config('rest.session')
class RestSessionConfig implements ManagedInterceptorConfig { }

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class AuthSessionInterceptor implements RestInterceptor {

  dependsOn: Class<RestInterceptor>[] = [AuthContextInterceptor];
  runsBefore: Class<RestInterceptor>[] = [];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  async intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      await this.service.load();
      Object.defineProperty(ctx.req, 'session', { get: () => this.service.getOrCreate() });
      return await next();
    } finally {
      await this.service.persist();
    }
  }
}

ParamExtractor.registerContext(asConcrete<SessionData>(), (_, req) => req.session?.data);