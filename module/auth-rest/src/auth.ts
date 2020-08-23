import { AppError } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';
import { AuthContext } from '@travetto/auth/src/context';
import { PrincipalSource } from '@travetto/auth';

import { IdentitySource } from './identity';

/**
 * Auth service to allow for rest-based interaction
 */
@Injectable()
export class AuthService {
  identitySources = new Map<string, IdentitySource>();

  @Inject()
  principalSource: PrincipalSource;

  async postConstruct() {
    // Find all identity sources
    for (const source of DependencyRegistry.getCandidateTypes(IdentitySource as Class<IdentitySource>)) {
      const dep = await DependencyRegistry.getInstance(IdentitySource, source.qualifier);
      this.identitySources.set(source.qualifier.toString(), dep);
    }
  }

  /**
   * Login user via the request. Supports multi-step login.
   * @param req The travetto request
   * @param res The travetto response
   * @param identitySources List of valid identity sources
   */
  async login(req: Request, res: Response, identitySources: symbol[]): Promise<AuthContext | undefined> {
    let lastError: Error | undefined;

    /**
     * Attempt to check login with multiple identity sources
     */
    for (const source of identitySources) {
      try {
        const idp = this.identitySources.get(source.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          return await this.principalSource.authorize(ident);
        } else {
          return;
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) {
      console.error(lastError);
    }

    // Take the last error and return
    const err = new AppError('Unable to authenticate', 'authentication');
    err.stack = lastError?.stack ?? err.stack;
    throw err;
  }
}