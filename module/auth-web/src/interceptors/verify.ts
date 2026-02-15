import { RuntimeError, Util } from '@travetto/runtime';
import type { WebInterceptor, WebInterceptorCategory, WebChainedContext, WebResponse, WebInterceptorContext } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthenticationError, type AuthContext } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

function matchPermissionSet(rule: string[], permissions: Set<string>): boolean {
  for (const permission of rule) {
    if (!permissions.has(permission)) {
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
export class AuthVerifyInterceptor implements WebInterceptor<WebAuthVerifyConfig> {

  category: WebInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthVerifyConfig;

  @Inject()
  authContext: AuthContext;

  finalizeConfig({ config }: WebInterceptorContext<WebAuthVerifyConfig>): WebAuthVerifyConfig {
    config.matcher = Util.allowDeny<string[], [Set<string>]>(config.permissions ?? [],
      item => item.split('|'),
      matchPermissionSet,
    );
    return config;
  }

  applies({ config }: WebInterceptorContext<WebAuthVerifyConfig>): boolean {
    return config.applies;
  }

  async filter({ config, next }: WebChainedContext<WebAuthVerifyConfig>): Promise<WebResponse> {
    const principal = this.authContext.principal;

    switch (config.state) {
      case 'authenticated': {
        if (!principal) {
          throw new AuthenticationError('User is unauthenticated');
        } else if (!config.matcher(new Set(principal.permissions))) {
          throw new RuntimeError('Access denied', { category: 'permissions' });
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