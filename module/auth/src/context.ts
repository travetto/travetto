
import { Inject, Injectable } from '@travetto/di';
import { AsyncContext, AsyncContextProp } from '@travetto/context';

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

  #authProp: AsyncContextProp<AuthContextShape>;

  @Inject()
  context: AsyncContext;

  postConstruct(): void {
    this.#authProp = this.context.prop(AuthContextSymbol);
  }

  /**
   * Initialize context
   * @private
   */
  init(): void {
    this.#authProp.set({});
  }

  /**
   * Get the principal, if set
   */
  get principal(): Principal | undefined {
    return this.#authProp.get()?.principal;
  }

  /**
   * Set principal
   */
  set principal(p: Principal | undefined) {
    this.#authProp.get()!.principal = p;
  }

  /**
   * Get the authentication token, if it exists
   */
  get authToken(): AuthToken | undefined {
    return this.#authProp.get()?.authToken;
  }

  /**
   * Set/overwrite the user's authentication token
   */
  set authToken(token: AuthToken | undefined) {
    this.#authProp.get()!.authToken = token;
  }

  /**
   * Get the authenticator state, if it exists
   */
  get authenticatorState(): AuthenticatorState | undefined {
    return this.#authProp.get()?.authenticatorState;
  }

  /**
   * Set/overwrite the authenticator state
   */
  set authenticatorState(state: AuthenticatorState | undefined) {
    this.#authProp.get()!.authenticatorState = state;
  }

  /**
   * Clear context
   * @private
   */
  async clear(): Promise<void> {
    this.#authProp.set({});
  }
}