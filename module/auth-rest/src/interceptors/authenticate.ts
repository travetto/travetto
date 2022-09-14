import { AppError } from '@travetto/base';
import { RestInterceptor, ManagedInterceptorConfig, FilterContext } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { AuthUtil } from '@travetto/auth';
import { Ignore } from '@travetto/schema';

import { AuthReadWriteInterceptor } from './readWrite';

@Config('rest.auth.verify')
export class RestAuthVerifyConfig extends ManagedInterceptorConfig {
  /**
   * Default state to care about
   */
  state?: 'authenticated' | 'unauthenticated';
  /**
   * What are the roles for verification, allowed or disallowed
   */
  roles: string[] = [];

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

  after = [AuthReadWriteInterceptor];

  @Inject()
  config: RestAuthVerifyConfig;

  /**
   * Ensures this is an opt-in interceptor
   */
  applies(): boolean {
    return false;
  }

  finalizeConfig(config: RestAuthVerifyConfig): RestAuthVerifyConfig {
    config.matcher = AuthUtil.roleMatcher(config.roles ?? []);
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