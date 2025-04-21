import { toConcrete } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { WebInterceptor, WebAsyncContext, WebInterceptorCategory, WebChainedContext, WebResponse } from '@travetto/web';
import { Session, SessionContext, SessionData, SessionService } from '@travetto/auth-session';
import { AuthContextInterceptor } from '@travetto/auth-web';

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class AuthSessionInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  service: SessionService;

  @Inject()
  context: SessionContext;

  @Inject()
  webAsyncContext: WebAsyncContext;

  postConstruct(): void {
    this.webAsyncContext.registerType(toConcrete<Session>(), () => this.context.get(true));
    this.webAsyncContext.registerType(toConcrete<SessionData>(), () => this.context.get(true).data);
  }

  async filter({ next }: WebChainedContext): Promise<WebResponse> {
    try {
      await this.service.load();
      return await next();
    } finally {
      await this.service.persist();
    }
  }
}