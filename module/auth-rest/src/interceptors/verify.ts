import { AppError, Util } from '@travetto/runtime';
import { RestInterceptor, ManagedInterceptorConfig, FilterContext, SerializeInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthenticationError, AuthContext } from '@travetto/auth';

import { AuthReadWriteInterceptor } from './read-write';

function matchPermissionSet(rule: string[], perms: Set<string>): boolean {
  for (const el of rule) {
    if (!perms.has(el)) {
      return false;
    }
  }
  return true;
}

@Config('rest.auth.verify')
export class RestAuthVerifyConfig extends ManagedInterceptorConfig {
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
export class AuthVerifyInterceptor implements RestInterceptor<RestAuthVerifyConfig> {

  dependsOn = [SerializeInterceptor, AuthReadWriteInterceptor];

  @Inject()
  config: RestAuthVerifyConfig;

  @Inject()
  authContext: AuthContext;

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  finalizeConfig(config: RestAuthVerifyConfig): RestAuthVerifyConfig {
    config.matcher = Util.allowDeny<string[], [Set<string>]>(config.permissions ?? [],
      x => x.split('|'),
      matchPermissionSet,
    );
    return config;
  }

  async intercept({ req, config }: FilterContext<RestAuthVerifyConfig>): Promise<void> {
    const principal = this.authContext.principal;

    switch (config?.state) {
      case 'authenticated': {
        if (!principal) {
          throw new AuthenticationError('User is unauthenticated');
        } else {
          if (!config.matcher(new Set(principal.permissions))) {
            throw new AppError('Access denied', { category: 'permissions' });
          }
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
  }
}