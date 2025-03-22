import { HttpInterceptor, HttpInterceptorCategory, HttpChainedContext } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthService } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.login')
export class WebAuthLoginConfig {
  @Ignore()
  providers: symbol[];
}

/**
 * Login interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Connects the principal to the request
 */
@Injectable()
export class AuthLoginInterceptor implements HttpInterceptor<WebAuthLoginConfig> {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];
  applies = false; // opt-in interceptor

  @Inject()
  config: WebAuthLoginConfig;

  @Inject()
  service: AuthService;

  async filter(ctx: HttpChainedContext<WebAuthLoginConfig>): Promise<unknown> {
    await this.service.authenticate(ctx.req.body, ctx, ctx.config.providers ?? []);
    return ctx.next();
  }
}