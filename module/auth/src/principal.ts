import { AppError } from '@travetto/base';

import { Identity, Principal } from './types';
import { AuthContext } from './context';

// TODO: Document
export abstract class PrincipalProvider {

  createPrincipal?(principal: Principal): Promise<Principal>;

  get autoCreate() { return false; }

  abstract resolvePrincipal(ident: Identity): Promise<Principal>;

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

  async authorize(ident: Identity): Promise<AuthContext> {
    return new AuthContext(ident, await this.resolveOrCreatePrincipal(ident));
  }
}