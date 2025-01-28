
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

  #auth = new AsyncContextValue<AuthContextShape>(this);

  @Inject()
  context: AsyncContext;

  /**
   * Initialize context
   * @private
   */
  init(): void {
    this.#auth.set({});
  }

  /**
   * Get the principal, if set
   */
  get principal(): Principal | undefined {
    return this.#auth.get()?.principal;
  }

  /**
   * Set principal
   */
  set principal(p: Principal | undefined) {
    this.#auth.get()!.principal = p;
  }

  /**
   * Get the authentication token, if it exists
   */
  get authToken(): AuthToken | undefined {
    return this.#auth.get()?.authToken;
  }

  /**
   * Set/overwrite the user's authentication token
   */
  set authToken(token: AuthToken | undefined) {
    this.#auth.get()!.authToken = token;
  }

  /**
   * Get the authenticator state, if it exists
   */
  get authenticatorState(): AuthenticatorState | undefined {
    return this.#auth.get()?.authenticatorState;
  }

  /**
   * Set/overwrite the authenticator state
   */
  set authenticatorState(state: AuthenticatorState | undefined) {
    this.#auth.get()!.authenticatorState = state;
  }

  /**
   * Clear context
   * @private
   */
  async clear(): Promise<void> {
    this.#auth.set(undefined);
  }
}