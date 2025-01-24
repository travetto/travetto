
import { Inject, Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { AuthToken } from './internal/types';
import { Principal } from './types/principal';
import { AuthenticatorState } from './types/authenticator';

const AuthContextSymbol = Symbol.for('@travetto/auth:context');

type AuthContextShape = {
  principal?: Principal;
  authToken?: AuthToken;
  authenticatorState?: AuthenticatorState;
};

@Injectable()
export class AuthContext {

  @Inject()
  context: AsyncContext;

  #getContext(setting = false): AuthContextShape | undefined {
    let v = this.context.get<AuthContextShape>(AuthContextSymbol);
    if (!v && setting) {
      this.context.set(AuthContextSymbol, v = {});
    }
    return v;
  }

  /**
   * Get the principal from the context
   * @returns principal if authenticated
   * @returns undefined if not authenticated
   */
  get principal(): Principal | undefined {
    return this.#getContext(false)?.principal;
  }

  /**
   * Set principal
   */
  set principal(p: Principal | undefined) {
    this.#getContext(true)!.principal = p;
  }

  /**
   * Get the authentication token, if it exists
   */
  get authToken(): AuthToken | undefined {
    return this.#getContext(false)?.authToken;
  }

  /**
   * Set/overwrite the user's authentication token
   */
  set authToken(token: AuthToken | undefined) {
    this.#getContext(true)!.authToken = token;
  }

  /**
   * Get the authenticator state, if it exists
   */
  get authenticatorState(): AuthenticatorState | undefined {
    return this.#getContext(false)?.authenticatorState;
  }

  /**
   * Set/overwrite the authenticator state
   */
  set authenticatorState(state: AuthenticatorState | undefined) {
    this.#getContext(true)!.authenticatorState = state;
  }

  /**
   * Clear context
   */
  async clear(): Promise<void> {
    this.context.set(AuthContextSymbol, undefined);
  }
}