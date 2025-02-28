import { Class, toConcrete } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { WebInterceptor, FilterContext, FilterNext, ManagedInterceptorConfig, ParamExtractor } from '@travetto/web';
import { SessionData, SessionService } from '@travetto/auth-session';

import { Config } from '@travetto/config';
import { AuthContextInterceptor } from '@travetto/auth-web';

@Config('web.session')
class WebSessionConfig implements ManagedInterceptorConfig { }

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class AuthSessionInterceptor implements WebInterceptor {

  dependsOn: Class<WebInterceptor>[] = [AuthContextInterceptor];
  runsBefore: Class<WebInterceptor>[] = [];

  @Inject()
  service: SessionService;

  @Inject()
  config: WebSessionConfig;

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

ParamExtractor.registerContext(toConcrete<SessionData>(), (_, req) => req.session?.data);