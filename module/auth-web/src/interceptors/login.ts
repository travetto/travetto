import type { AuthService } from '@travetto/auth';
import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { Ignore } from '@travetto/schema';
import type { WebChainedContext, WebInterceptor, WebInterceptorCategory, WebInterceptorContext, WebResponse } from '@travetto/web';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.login')
export class WebAuthLoginConfig {
  /**
   * Execute login on endpoint
   */
  applies = false;
  /**
   * The auth providers to iterate through when attempting to authenticate
   */
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
export class AuthLoginInterceptor implements WebInterceptor<WebAuthLoginConfig> {
  category: WebInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthLoginConfig;

  @Inject()
  service: AuthService;

  applies({ config }: WebInterceptorContext<WebAuthLoginConfig>): boolean {
    return config.applies;
  }

  async filter(ctx: WebChainedContext<WebAuthLoginConfig>): Promise<WebResponse> {
    await this.service.authenticate(ctx.request.body, ctx, ctx.config.providers ?? []);
    return ctx.next();
  }
}
