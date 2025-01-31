import { RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, SerializeInterceptor, FilterNext } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AuthContext, AuthenticationError } from '@travetto/auth';

import { AuthCodecInterceptor } from './codec';

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
  authContext: AuthContext;

  dependsOn = [SerializeInterceptor, AuthCodecInterceptor];

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: FilterContext<RestAuthLogoutConfig>, next: FilterNext): Promise<FilterReturn> {
    try {
      if (!this.authContext.principal) {
        throw new AuthenticationError('Already logged out');
      }
      return await next();
    } finally {
      await this.authContext.clear();
    }
  }
}