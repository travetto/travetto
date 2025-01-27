
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';

import { AuthenticatorTarget } from './internal/types';
import { Principal } from './types/principal';
import { Authenticator } from './types/authenticator';
import { Authorizer } from './types/authorizer';
import { AuthenticationError } from './types/error';
import { AuthContext } from './context';
import { TimeUtil } from '@travetto/runtime';

@Injectable()
export class AuthService {

  @Inject()
  authContext: AuthContext;

  #authenticators = new Map<symbol, Promise<Authenticator>>();

  @Inject()
  authorizer?: Authorizer;

  async postConstruct(): Promise<void> {
    // Find all authenticators
    for (const source of DependencyRegistry.getCandidateTypes(AuthenticatorTarget)) {
      const dep = DependencyRegistry.getInstance<Authenticator>(AuthenticatorTarget, source.qualifier);
      this.#authenticators.set(source.qualifier, dep);
    }
  }

  /**
   * Get authenticators by keys
   */
  async getAuthenticators<T = unknown, C = unknown>(keys: symbol[]): Promise<Authenticator<T, C>[]> {
    return await Promise.all(keys.map(key => this.#authenticators.get(key)!));
  }

  /**
   * Authenticate. Supports multi-step login.
   * @param ctx The authenticator context
   * @param authenticators List of valid authentication sources
   */
  async authenticate<T, C>(payload: T, context: C, authenticators: symbol[]): Promise<Principal | undefined> {
    let lastError: Error | undefined;

    /**
     * Attempt to authenticate, checking with multiple authentication sources
     */
    for (const idp of await this.getAuthenticators<T, C>(authenticators)) {
      try {
        const principal = await idp.authenticate(payload, context);

        if (idp.getState) {
          this.authContext.authenticatorState = await idp.getState(context);
        }

        if (!principal) { // Multi-step login process
          return;
        }
        return this.authContext.principal = (await this.authorizer?.authorize(principal)) ?? principal;
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
   * Enforce expiry
   */
  enforceExpiry(p: Principal, maxAgeMs?: number, rollingRenew?: boolean): void {
    if (maxAgeMs) {
      p.expiresAt ??= TimeUtil.fromNow(maxAgeMs);
    }

    p.issuedAt ??= new Date();

    if (maxAgeMs && rollingRenew) { // Session behavior
      const end = p.expiresAt!.getTime();
      const midPoint = end - maxAgeMs / 2;
      if (Date.now() > midPoint) { // If we are past the half way mark, renew the token
        p.issuedAt = new Date();
        p.expiresAt = TimeUtil.fromNow(maxAgeMs); // This will trigger a re-send
      }
    }
  }
}