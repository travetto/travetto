
import { Inject, Injectable } from '@travetto/di';
import { AsyncContext } from '@travetto/context';

import { AuthToken, AuthTokenSymbol, PrincipalSymbol } from './internal/types';
import { Principal } from './types/principal';

@Injectable()
export class AuthContextService {

  @Inject()
  context: AsyncContext;

  /**
   * Get the authentication token, if it exists
   */
  getAuthenticationToken(): AuthToken | undefined {
    return this.context.get<AuthToken>(AuthTokenSymbol);
  }

  /**
   * Set/overwrite the user's authentication token
   */
  setAuthenticationToken(token: AuthToken): void {
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
}