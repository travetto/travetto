import { HttpInterceptor, HttpInterceptorCategory, HttpContext } from '@travetto/web';
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

  @Inject()
  config: WebAuthLoginConfig;

  @Inject()
  service: AuthService;

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async filter(ctx: HttpContext<WebAuthLoginConfig>): Promise<unknown> {
    await this.service.authenticate(ctx.req.body, ctx, ctx.config.providers ?? []);
    return ctx.next();
  }
}