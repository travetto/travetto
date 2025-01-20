import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, SerializeInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';

import { LoginService } from '../service';
import { AuthReadWriteInterceptor } from './read-write';

@Config('rest.auth.login')
export class RestAuthLoginConfig extends ManagedInterceptorConfig {
  @Ignore()
  providers: symbol[];
}

/**
 * Authentication interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Connects the principal to the request
 */
@Injectable()
export class AuthLoginInterceptor implements RestInterceptor<RestAuthLoginConfig> {

  @Inject()
  config: RestAuthLoginConfig;

  @Inject()
  service: LoginService;

  dependsOn = [SerializeInterceptor, AuthReadWriteInterceptor];

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: FilterContext<RestAuthLoginConfig>): Promise<FilterReturn> {
    return this.service.login(ctx, ctx.config.providers ?? []);
  }
}