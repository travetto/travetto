import type { Session, SessionContext, SessionData, SessionService } from '@travetto/auth-session';
import { AuthContextInterceptor } from '@travetto/auth-web';
import { Inject, Injectable, PostConstruct } from '@travetto/di';
import { toConcrete } from '@travetto/runtime';
import type { WebAsyncContext, WebChainedContext, WebInterceptor, WebInterceptorCategory, WebResponse } from '@travetto/web';

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

  @PostConstruct()
  exposeSessionContext(): void {
    this.webAsyncContext.registerSource(toConcrete<Session>(), () => this.context.get(true));
    this.webAsyncContext.registerSource(toConcrete<SessionData>(), () => this.context.get(true).data);
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
