import { toConcrete } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { HttpInterceptor, HttpContext, WebContext, HttpInterceptorCategory, NextFunction } from '@travetto/web';
import { Session, SessionContext, SessionData, SessionService } from '@travetto/auth-session';
import { Config } from '@travetto/config';
import { AuthContextInterceptor } from '@travetto/auth-web';

@Config('web.session')
class WebSessionConfig { }

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class AuthSessionInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

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

  async filter(_: HttpContext, next: NextFunction): Promise<unknown> {
    try {
      await this.service.load();
      return await next();
    } finally {
      await this.service.persist();
    }
  }
}