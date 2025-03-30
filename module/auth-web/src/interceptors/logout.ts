import { HttpInterceptor, HttpInterceptorCategory, HttpChainedContext, EndpointConfig, HttpResponse } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AuthContext, AuthenticationError } from '@travetto/auth';

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
export class AuthLogoutInterceptor implements HttpInterceptor<WebAuthLogoutConfig> {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthLogoutConfig;

  @Inject()
  authContext: AuthContext;

  applies(ep: EndpointConfig, config: WebAuthLogoutConfig): boolean {
    return config.applies;
  }

  async filter({ next }: HttpChainedContext): Promise<HttpResponse> {
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