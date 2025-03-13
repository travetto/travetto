import { HttpInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, SerializeInterceptor } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthService } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.login')
export class WebAuthLoginConfig extends ManagedInterceptorConfig {
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

  @Inject()
  config: WebAuthLoginConfig;

  @Inject()
  service: AuthService;

  dependsOn = [SerializeInterceptor, AuthContextInterceptor];

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: FilterContext<WebAuthLoginConfig>): Promise<FilterReturn> {
    await this.service.authenticate(ctx.req.body, ctx, ctx.config.providers ?? []);
    return;
  }
}