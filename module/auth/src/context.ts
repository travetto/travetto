
import { Inject, Injectable } from '@travetto/di';
import { AsyncContext, AsyncContextValue } from '@travetto/context';

import { AuthToken } from './types/token';
import { Principal } from './types/principal';
import { AuthenticatorState } from './types/authenticator';

type AuthContextShape = {
  principal?: Principal;
  authToken?: AuthToken;
  authenticatorState?: AuthenticatorState;
};

@Injectable()
export class AuthContext {

  #value = new AsyncContextValue<AuthContextShape>(this);

  @Inject()
  context: AsyncContext;

  /**
   * Initialize context
   * @private
   */
  init(): void {
    this.#value.set({});
  }

  /**
   * Get the principal, if set
   */
  get principal(): Principal | undefined {
    return this.#value.get()?.principal;
  }

  /**
   * Set principal
   */
  set principal(p: Principal | undefined) {
    this.#value.get()!.principal = p;
  }

  /**
   * Get the authentication token, if it exists
   */
  get authToken(): AuthToken | undefined {
    return this.#value.get()?.authToken;
  }

  /**
   * Set/overwrite the user's authentication token
   */
  set authToken(token: AuthToken | undefined) {
    this.#value.get()!.authToken = token;
  }

  /**
   * Get the authenticator state, if it exists
   */
  get authenticatorState(): AuthenticatorState | undefined {
    return this.#value.get()?.authenticatorState;
  }

  /**
   * Set/overwrite the authenticator state
   */
  set authenticatorState(state: AuthenticatorState | undefined) {
    this.#value.get()!.authenticatorState = state;
  }

  /**
   * Clear context
   * @private
   */
  async clear(): Promise<void> {
    this.#value.set(undefined);
  }
}