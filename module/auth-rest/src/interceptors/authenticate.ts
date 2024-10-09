import { AppError, Util } from '@travetto/runtime';
import { RestInterceptor, ManagedInterceptorConfig, FilterContext, SerializeInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';

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
    switch (config?.state) {
      case 'authenticated': {
        if (!req.auth) {
          throw new AppError('User is unauthenticated', 'authentication');
        } else {
          if (!config.matcher(new Set(req.auth.permissions))) {
            throw new AppError('Access denied', 'permissions');
          }
        }
        break;
      }
      case 'unauthenticated': {
        if (req.auth) {
          throw new AppError('User is authenticated', 'authentication');
        }
        break;
      }
    }
  }
}