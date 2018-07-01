import { Inject, Injectable } from '@travetto/di';
import { Context } from '@travetto/context';

import { AuthContext, ERR_UNAUTHENTICATED, ERR_FORBIDDEN } from '../types';

@Injectable()
export class AuthService<U = { id: string }> {

  @Inject()
  protected _context: Context;

  get context() {
    return this._context.get().auth;
  }

  set context(ctx: AuthContext<U> | undefined) {
    this._context.get().auth = ctx;
  }

  clearContext() {
    this.context = undefined;
  }

  get authenticated() {
    return !this.unauthenticated;
  }

  get unauthenticated() {
    return !this.context;
  }

  checkPermissions(include: string[], exclude: string[]) {
    if (this.unauthenticated) {
      throw new Error(ERR_UNAUTHENTICATED);
    }

    const perms = this.context!.permissions;

    if (exclude.length && exclude.find(x => perms.has(x))) {
      throw new Error(ERR_FORBIDDEN);
    }
    if (include.length && include.find(x => !perms.has(x))) {
      throw new Error(ERR_FORBIDDEN);
    }
  }
}
