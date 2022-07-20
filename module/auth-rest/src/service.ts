import { AppError, Class } from '@travetto/base';
import { Request, Response } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Principal, Authorizer, Authenticator } from '@travetto/auth';
import { AuthenticatorTarget } from '@travetto/auth/src/internal/types';

/**
 * Auth service to allow for rest-based interaction
 */
@Injectable()
export class AuthService {
  #authenticators = new Map<symbol, Authenticator>();

  @Inject()
  authorizer?: Authorizer;

  async postConstruct() {
    // Find all identity sources
    for (const source of DependencyRegistry.getCandidateTypes<Authenticator>(
      AuthenticatorTarget as unknown as Class<Authenticator>
    )) {
      const dep = await DependencyRegistry.getInstance<Authenticator>(AuthenticatorTarget, source.qualifier);
      this.#authenticators.set(source.qualifier, dep);
    }
  }

  /**
   * Login user via the request. Supports multi-step login.
   * @param req The travetto request
   * @param res The travetto response
   * @param authenticators List of valid identity sources
   */
  async login(req: Request, res: Response, authenticators: symbol[]): Promise<Principal | undefined> {
    let lastError: Error | undefined;

    /**
     * Attempt to check login with multiple identity sources
     */
    for (const auth of authenticators) {
      try {
        const idp = this.#authenticators.get(auth)!;
        const principal = await idp.authenticate(req.body, { req, res });
        if (!principal) { // Multi-step login process
          return;
        }
        req.auth = this.authorizer ? await this.authorizer.authorize(principal) : principal;
        return req.auth;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError) {
      console.warn('Failed to authenticate', { error: lastError, sources: authenticators.map(x => x.toString()) });
    }

    // Take the last error and return
    const finalError = new AppError('Unable to authenticate', 'authentication');
    finalError.stack = lastError?.stack ?? finalError.stack;
    throw finalError;
  }

  /**
   * Log user out
   */
  async logout(req: Request) {
    req.auth = undefined;
  }
}