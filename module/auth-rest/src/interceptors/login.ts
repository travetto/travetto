import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, SerializeInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthService } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('rest.auth.login')
export class RestAuthLoginConfig extends ManagedInterceptorConfig {
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
export class AuthLoginInterceptor implements RestInterceptor<RestAuthLoginConfig> {

  @Inject()
  config: RestAuthLoginConfig;

  @Inject()
  service: AuthService;

  dependsOn = [SerializeInterceptor, AuthContextInterceptor];

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: FilterContext<RestAuthLoginConfig>): Promise<FilterReturn> {
    await this.service.authenticate(ctx.req.body, ctx, ctx.config.providers ?? []);
    return;
  }
}