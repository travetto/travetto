import { AppError, Util } from '@travetto/runtime';
import { HttpInterceptor, HttpInterceptorCategory, HttpChainedContext, EndpointConfig, HttpResponse } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthenticationError, AuthContext } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

function matchPermissionSet(rule: string[], perms: Set<string>): boolean {
  for (const el of rule) {
    if (!perms.has(el)) {
      return false;
    }
  }
  return true;
}

@Config('web.auth.verify')
export class WebAuthVerifyConfig {
  /**
   * Verify user is in a specific auth state
   */
  applies = false;
  /**
   * Default state to care about
   */
  state?: 'authenticated' | 'unauthenticated';
  /**
   * What are the permissions for verification, allowed or disallowed
   */
  permissions: string[] = [];

  @Ignore()
  matcher: (key: Set<string>) => boolean;
}

/**
 * Authenticate interceptor
 *
 * Enforces if the user should be authenticated
 */
@Injectable()
export class AuthVerifyInterceptor implements HttpInterceptor<WebAuthVerifyConfig> {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthVerifyConfig;

  @Inject()
  authContext: AuthContext;

  finalizeConfig(config: WebAuthVerifyConfig): WebAuthVerifyConfig {
    config.matcher = Util.allowDeny<string[], [Set<string>]>(config.permissions ?? [],
      x => x.split('|'),
      matchPermissionSet,
    );
    return config;
  }

  applies(ep: EndpointConfig, config: WebAuthVerifyConfig): boolean {
    return config.applies;
  }

  async filter({ config, next }: HttpChainedContext<WebAuthVerifyConfig>): Promise<HttpResponse> {
    const principal = this.authContext.principal;

    switch (config.state) {
      case 'authenticated': {
        if (!principal) {
          throw new AuthenticationError('User is unauthenticated');
        } else if (!config.matcher(new Set(principal.permissions))) {
          throw new AppError('Access denied', { category: 'permissions' });
        }
        break;
      }
      case 'unauthenticated': {
        if (principal) {
          throw new AuthenticationError('User is authenticated');
        }
        break;
      }
    }
    return next();
  }
}