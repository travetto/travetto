import { AppError } from '@travetto/base';

import { Identity, Principal } from './types';
import { AuthContext } from './context';

/**
 * Produces a principal from an identity
 */
export abstract class PrincipalSource {

  /**
   * Optional ability to create a principal as opposed to just reading
   */
  createPrincipal?(principal: Principal): Promise<Principal>;

  /**
   * Auto create principal as needed, requires createPrincipal to exist
   */
  get autoCreate() { return false; }

  /**
   * Resolves an identity to a principal
   */
  abstract resolvePrincipal(ident: Identity): Promise<Principal>;

  /**
   * Resolves or creates a principal as needed
   */
  async resolveOrCreatePrincipal(ident: Identity) {
    try {
      return await this.resolvePrincipal(ident);
    } catch (e) {
      if (this.autoCreate && this.createPrincipal && ((e instanceof AppError && e.category === 'notfound') || /not found/i.test(e.message))) {
        return await this.createPrincipal(ident);
      } else {
        throw e;
      }
    }
  }

  /**
   * Authorizes an identity to produce an AuthContext
   */
  async authorize(ident: Identity): Promise<AuthContext> {
    return new AuthContext(ident, await this.resolveOrCreatePrincipal(ident));
  }
}