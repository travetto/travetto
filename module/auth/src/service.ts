import { Inject, Injectable } from '@travetto/di';
import { Context } from '@travetto/context';
import { AppError } from '@travetto/base';

import { AuthContext, Identity } from './types';
import { PrincipalProvider } from './principal';
import { AuthUtil } from './util';

const EMPTY_SET = new Set<string>();

@Injectable()
export class AuthService<U = any> {

  @Inject()
  public contextProvider: Context;

  @Inject()
  public principalProvider: PrincipalProvider;

  get context(): AuthContext {
    return (this.contextProvider.get() || {}).auth || {};
  }

  set context(ctx: AuthContext) {
    this.contextProvider.get().auth = ctx;
  }

  get principalDetails() {
    return this.principal.details as U;
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

  updatePrincipalDetails(details: U) {
    if (this.principal) {
      Object.assign(this.principal.details, details);
    }
  }

  setPrincipalDetails(details: U) {
    if (this.principal) {
      this.principal.details = details;
    }
  }

  async authorize(identity: Identity) {
    const ctx = this.context = await this.principalProvider.authorize(identity);
    ctx.principal = ctx.principal || ctx.identity;
    ctx.principal.permissions = ctx.principal.permissions || new Set<string>();
    return ctx;
  }

  checkPermissions(include: string[] | Set<string>, exclude: string[] | Set<string>, matchAll = true) {
    const perms = this.principal ? this.principal.permissions : EMPTY_SET;
    if (!AuthUtil.permissionSetChecker(include, exclude, matchAll)(perms)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}
