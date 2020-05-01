import { AppError } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Class } from '@travetto/registry';
import { PrincipalProvider } from '@travetto/auth';

import { IdentityProvider } from './identity';
import { AuthContext } from '@travetto/auth/src/context';

/**
 * Auth service to allow for rest-based interaction
 */
@Injectable()
export class AuthService {
  identityProviders = new Map<string, IdentityProvider>();

  @Inject()
  principalProvider: PrincipalProvider;

  async postConstruct() {
    // Find all providers
    for (const provider of DependencyRegistry.getCandidateTypes(IdentityProvider as Class<IdentityProvider>)) {
      const dep = await DependencyRegistry.getInstance(IdentityProvider, provider.qualifier);
      this.identityProviders.set(provider.qualifier.toString(), dep);
    }
  }

  /**
   * Login user via the request. Supports multi-step login.
   *
   * @param identityProviders List of valid identity providers
   */
  async login(req: Request, res: Response, identityProviders: symbol[]): Promise<AuthContext | undefined> {
    let lastError: Error | undefined;

    /**
     * Attempt to check login with multiple identity providers
     */
    for (const provider of identityProviders) {
      try {
        const idp = this.identityProviders.get(provider.toString())!;
        const ident = await idp.authenticate(req, res);
        if (ident) { // Multi-step login process
          return await this.principalProvider.authorize(ident);
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