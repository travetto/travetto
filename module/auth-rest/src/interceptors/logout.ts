import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, SerializeInterceptor, FilterNext } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AppError } from '@travetto/runtime';

import { LoginService } from '../service';
import { AuthReadWriteInterceptor } from './read-write';

@Config('rest.auth.logout')
export class RestAuthLogoutConfig extends ManagedInterceptorConfig { }

/**
 * Logout interceptor
 *
 * Throws an error if the user is not logged in at time of logout
 */
@Injectable()
export class AuthLogoutInterceptor implements RestInterceptor<RestAuthLogoutConfig> {

  @Inject()
  config: RestAuthLogoutConfig;

  @Inject()
  service: LoginService;

  dependsOn = [SerializeInterceptor, AuthReadWriteInterceptor];

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: FilterContext<RestAuthLogoutConfig>, next: FilterNext): Promise<FilterReturn> {
    try {
      if (!ctx.req.auth) {
        throw new AppError('Already logged out', { category: 'permissions' });
      }
      return await next();
    } finally {
      await this.service.logout(ctx.req);
    }
  }
}