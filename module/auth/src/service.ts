
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';
import { castTo } from '@travetto/runtime';

import { AuthenticatorTarget, AuthToken, AuthTokenSymbol, PrincipalSymbol } from './internal/types';
import { Principal } from './types/principal';
import { AuthenticatorContext, Authenticator } from './types/authenticator';
import { Authorizer } from './types/authorizer';
import { AuthenticationError } from './types/error';

@Injectable()
export class AuthService {

  @Inject()
  context: AsyncContext;

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
   * Get the authentication token, if it exists
   */
  getAuthenticationToken(): AuthToken | undefined {
    return this.context.get<AuthToken>(AuthTokenSymbol);
  }

  /**
   * Set/overwrite the user's authentication token
   */
  setAuthenticationToken(token: AuthToken | undefined): void {
    this.context.set(AuthTokenSymbol, token);
  }

  /**
   * Set principal
   * @param p The auth principal
   */
  setPrincipal(p: Principal | undefined): void {
    this.context.set(PrincipalSymbol, p);
  }

  /**
   * Get the principal from the context
   * @returns principal if authenticated
   * @returns undefined if not authenticated
   */
  getPrincipal<T = { [key: string]: unknown }>(): (Principal<T> | undefined) {
    return this.context.get<Principal<T>>(PrincipalSymbol);
  }

  /**
   * Authenticate. Supports multi-step login.
   * @param ctx The authenticator context
   * @param authenticators List of valid authentication sources
   */
  async authenticate<C extends AuthenticatorContext>(ctx: C, authenticators: symbol[]): Promise<Principal | undefined> {
    let lastError: Error | undefined;

    /**
     * Attempt to authenticate, checking with multiple authentication sources
     */
    for (const auth of authenticators) {
      try {
        const idp = await this.#authenticators.get(auth)!;
        const principal = await idp.authenticate(castTo(ctx));
        if (!principal) { // Multi-step login process
          return;
        }
        const final = this.authorizer ? await this.authorizer.authorize(principal) : principal;
        return await ctx.finalize?.(final) ?? final;
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

  async deauthenticate(): Promise<void> {
    this.setAuthenticationToken(undefined);
    this.setPrincipal(undefined);
  }
}