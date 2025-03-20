import { Class, toConcrete } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { HttpInterceptor, HttpContext, WebFilterNext, ManagedInterceptorConfig, WebContext } from '@travetto/web';
import { Session, SessionContext, SessionData, SessionService } from '@travetto/auth-session';
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
  context: SessionContext;

  @Inject()
  config: WebSessionConfig;

  @Inject()
  webContext: WebContext;

  postConstruct(): void {
    this.webContext.registerType(toConcrete<Session>(), () => this.context.get(true));
    this.webContext.registerType(toConcrete<SessionData>(), () => this.context.get(true).data);
  }

  async intercept(ctx: HttpContext, next: WebFilterNext): Promise<unknown> {
    try {
      await this.service.load();
      return await next();
    } finally {
      await this.service.persist();
    }
  }
}