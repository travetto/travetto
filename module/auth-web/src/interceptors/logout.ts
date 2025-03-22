import { HttpInterceptor, HttpInterceptorCategory, HttpChainedContext } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AuthContext, AuthenticationError } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.logout')
export class WebAuthLogoutConfig { }

/**
 * Logout interceptor
 *
 * Throws an error if the user is not logged in at time of logout
 */
@Injectable()
export class AuthLogoutInterceptor implements HttpInterceptor<WebAuthLogoutConfig> {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthLogoutConfig;

  @Inject()
  authContext: AuthContext;

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  async filter({ next }: HttpChainedContext): Promise<unknown> {
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