import { Inject, Injectable, InjectableFactory } from '@travetto/di';
import { AsyncContext, AsyncContextValue } from '@travetto/context';

import { AuthToken } from './types/token';
import { Principal } from './types/principal';
import { AuthenticatorState } from './types/authenticator';

/**
 * Provides the primary context for the authenticated state
 *
 * Will silently fail on reads, but will error on writes if the context is not established.
 */
@Injectable()
export class AuthContext {

  #principal = new AsyncContextValue<Principal>(this, { failIfUnbound: { write: true } });
  #authToken = new AsyncContextValue<AuthToken>(this, { failIfUnbound: { write: true } });
  #authState = new AsyncContextValue<AuthenticatorState>(this, { failIfUnbound: { write: true } });

  @Inject()
  context: AsyncContext;

  /**
   * Get the principal, if set
   */
  get principal(): Principal | undefined {
    return this.#principal.get();
  }

  /**
   * Set principal
   */
  set principal(p: Principal | undefined) {
    this.#principal.set(p);
  }

  /**
   * Get the authentication token, if it exists
   */
  get authToken(): AuthToken | undefined {
    return this.#authToken.get();
  }

  /**
   * Set/overwrite the user's authentication token
   */
  set authToken(token: AuthToken | undefined) {
    this.#authToken.set(token);
  }

  /**
   * Get the authenticator state, if it exists
   */
  get authenticatorState(): AuthenticatorState | undefined {
    return this.#authState.get();
  }

  /**
   * Set/overwrite the authenticator state
   */
  set authenticatorState(state: AuthenticatorState | undefined) {
    this.#authState.set(state);
  }

  /**
   * Clear context
   * @private
   */
  async clear(): Promise<void> {
    this.#principal.set(undefined);
    this.#authToken.set(undefined);
    this.#authState.set(undefined);
  }
}