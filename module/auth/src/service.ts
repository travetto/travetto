import { Inject, Injectable } from '@travetto/di';
import { Context } from '@travetto/context';
import { AppError } from '@travetto/base';

import { AuthContext, Identity } from './types';
import { PrincipalProvider } from './principal';
import { AuthUtil } from './util';

export const AUTH_PERM = '__AUTH__';

const EMPTY_SET = new Set<string>();

@Injectable()
export class AuthService {

  @Inject()
  protected _context: Context;

  @Inject()
  protected _principal: PrincipalProvider;

  get context(): AuthContext {
    return (this._context.get() || {}).auth || {};
  }

  set context(ctx: AuthContext) {
    this._context.get().auth = ctx;
  }

  get principal() {
    return this.context.principal;
  }

  get authenticated() {
    return !this.unauthenticated;
  }

  get unauthenticated() {
    return !this.principal;
  }

  logout() {
    this.context = {} as any;
  }

  async updatePrincipalDetails(details: { [key: string]: any }) {
    if (this.principal) {
      Object.assign(this.principal.details, details);
    }
  }

  async authorize(identity: Identity) {
    const ctx = this.context = await this._principal.authorize(identity);
    ctx.principal = ctx.principal || ctx.identity;
    ctx.principal.permissions = ctx.principal.permissions || new Set<string>();
    ctx.principal.permissions.add(AUTH_PERM);
  }

  checkPermissions(include: string[] | Set<string>, exclude: string[] | Set<string>, matchAll = true) {
    const perms = this.principal ? this.principal.permissions : EMPTY_SET;
    if (!AuthUtil.permissionSetChecker(include, exclude, matchAll)(perms)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}
