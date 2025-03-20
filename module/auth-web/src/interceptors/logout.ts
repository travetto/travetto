import { HttpInterceptor, ManagedInterceptorConfig, FilterContext, FilterReturn, FilterNext, InterceptorGroup } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AuthContext, AuthenticationError } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.logout')
export class WebAuthLogoutConfig extends ManagedInterceptorConfig { }

/**
 * Logout interceptor
 *
 * Throws an error if the user is not logged in at time of logout
 */
@Injectable()
export class AuthLogoutInterceptor implements HttpInterceptor<WebAuthLogoutConfig> {

  @Inject()
  config: WebAuthLogoutConfig;

  @Inject()
  authContext: AuthContext;

  dependsOn = [InterceptorGroup.Application, AuthContextInterceptor];

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async intercept(ctx: FilterContext<WebAuthLogoutConfig>, next: FilterNext): Promise<FilterReturn> {
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