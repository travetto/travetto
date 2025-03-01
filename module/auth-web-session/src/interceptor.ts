import { Class, toConcrete } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { HttpInterceptor, FilterContext, FilterNext, ManagedInterceptorConfig, EndpointUtil } from '@travetto/web';
import { SessionData, SessionService } from '@travetto/auth-session';

import { Config } from '@travetto/config';
import { AuthContextInterceptor } from '@travetto/auth-web';

@Config('web.session')
class WebSessionConfig implements ManagedInterceptorConfig { }

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class AuthSessionInterceptor implements HttpInterceptor {

  dependsOn: Class<HttpInterceptor>[] = [AuthContextInterceptor];
  runsBefore: Class<HttpInterceptor>[] = [];

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

EndpointUtil.registerContextParam(toConcrete<SessionData>(), (_, req) => req.session?.data);