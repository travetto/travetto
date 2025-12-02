
import { DependencyRegistryIndex, getDefaultQualifier, Inject, Injectable } from '@travetto/di';
import { toConcrete, TimeUtil } from '@travetto/runtime';

import { Principal } from './types/principal.ts';
import { Authenticator } from './types/authenticator.ts';
import { Authorizer } from './types/authorizer.ts';
import { AuthenticationError } from './types/error.ts';
import { AuthContext } from './context.ts';
import { AuthConfig } from './config.ts';

@Injectable()
export class AuthService {

  @Inject()
  authContext: AuthContext;

  @Inject()
  config: AuthConfig;

  #authenticators = new Map<symbol, Promise<Authenticator>>();

  @Inject()
  authorizer?: Authorizer;

  async postConstruct(): Promise<void> {
    // Find all authenticators
    const AuthenticatorTarget = toConcrete<Authenticator>();
    for (const source of DependencyRegistryIndex.getCandidates(AuthenticatorTarget)) {
      const qual = source.qualifier || getDefaultQualifier(source.class);
      const dep = DependencyRegistryIndex.getInstance(AuthenticatorTarget, qual);
      this.#authenticators.set(qual, dep);
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
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }
        lastError = error;
      }
    }

    if (lastError) {
      console.warn('Failed to authenticate', { error: lastError, sources: authenticators.map(x => x.toString()) });
    }

    // Take the last error and return
    throw new AuthenticationError('Unable to authenticate', { cause: lastError });
  }

  /**
   * Manage expiry state, renewing if allowed
   */
  manageExpiry(p?: Principal): void {
    if (!p) {
      return;
    }

    if (this.config.maxAgeMs) {
      p.expiresAt ??= TimeUtil.fromNow(this.config.maxAgeMs);
    }

    p.issuedAt ??= new Date();

    if (p.expiresAt && this.config.maxAgeMs && this.config.rollingRenew) { // Session behavior
      const end = p.expiresAt.getTime();
      const midPoint = end - this.config.maxAgeMs / 2;
      if (Date.now() > midPoint) { // If we are past the half way mark, renew the token
        p.issuedAt = new Date();
        p.expiresAt = TimeUtil.fromNow(this.config.maxAgeMs); // This will trigger a re-send
      }
    }
  }

  /**
   * Enforce expiry, invalidating the principal if expired
   */
  enforceExpiry(p?: Principal): Principal | undefined {
    if (p && p.expiresAt && p.expiresAt.getTime() < Date.now()) {
      return undefined;
    }
    return p;
  }
}