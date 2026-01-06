import type { WebInterceptor, WebInterceptorCategory, WebChainedContext, WebResponse, WebInterceptorContext } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { type AuthContext, AuthenticationError } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.logout')
export class WebAuthLogoutConfig {
  /**
   * Execute logout on endpoint
   */
  applies = false;
}

/**
 * Logout interceptor
 *
 * Throws an error if the user is not logged in at time of logout
 */
@Injectable()
export class AuthLogoutInterceptor implements WebInterceptor<WebAuthLogoutConfig> {

  category: WebInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthLogoutConfig;

  @Inject()
  authContext: AuthContext;

  applies({ config }: WebInterceptorContext<WebAuthLogoutConfig>): boolean {
    return config.applies;
  }

  async filter({ next }: WebChainedContext): Promise<WebResponse> {
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