import { FilterContext, Request } from '@travetto/rest';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { Principal, Authorizer, Authenticator, AuthenticationError } from '@travetto/auth';
import { AuthenticatorTarget } from '@travetto/auth/src/internal/types';

/**
 * Auth service to handle login/logout
 */
@Injectable()
export class LoginService {
  #authenticators = new Map<symbol, Promise<Authenticator>>();

  @Inject()
  authorizer?: Authorizer;

  async postConstruct(): Promise<void> {
    // Find all identity sources
    for (const source of DependencyRegistry.getCandidateTypes<Authenticator, AuthenticatorTarget>(AuthenticatorTarget)) {
      const dep = DependencyRegistry.getInstance<Authenticator>(AuthenticatorTarget, source.qualifier);
      this.#authenticators.set(source.qualifier, dep);
    }
  }

  /**
   * Login user via the request. Supports multi-step login.
   * @param ctx The travetto context
   * @param authenticators List of valid identity sources
   */
  async login({ req, res }: FilterContext, authenticators: symbol[]): Promise<Principal | undefined> {
    let lastError: Error | undefined;

    /**
     * Attempt to check login with multiple identity sources
     */
    for (const auth of authenticators) {
      try {
        const idp = await this.#authenticators.get(auth)!;
        await idp.initialize?.({ req, res });
        const principal = await idp.authenticate(req.body, { req, res });
        if (!principal) { // Multi-step login process
          return;
        }
        req.auth = this.authorizer ? await this.authorizer.authorize(principal) : principal;
        return req.auth;
      } catch (err) {
        if (!(err instanceof Error)) {
          throw err;
        }
        lastError = err;
      }
    }

    if (lastError) {
      console.warn('Failed to authenticate', { error: lastError, sources: authenticators.map(x => x.toString()) });
    }

    // Take the last error and return
    throw new AuthenticationError('Unable to authenticate', { cause: lastError });
  }

  /**
   * Log user out
   */
  async logout(req: Request): Promise<void> {
    req.auth = undefined;
  }
}