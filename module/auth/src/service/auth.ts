import { Inject } from '@travetto/di';
import { Context } from '@travetto/context';
import { AuthSource } from '../source';
import { AuthContext, ERR_UNAUTHENTICATED, ERR_FORBIDDEN, ERR_INVALID_CREDS } from './types';

export class AuthService<U = { id: string }> {

  @Inject()
  protected _context: Context;

  constructor(public source: AuthSource<U>) { }

  private extractLogin(...objs: { [key: string]: string }[]) {
    const idField = this.source.principal.idField;
    const pwField = this.source.principal.passwordField;

    const valid = objs.find(x => idField in x) || {};

    return {
      userId: valid[idField],
      password: valid[pwField]
    };
  }

  get context() {
    return this._context.get().auth;
  }

  set context(ctx: AuthContext<U> | undefined) {
    this._context.get().auth = ctx;
  }

  get authenticated() {
    return !!this.context;
  }

  get unauthenticated() {
    return !this.context;
  }

  async loginFromPayload(...objs: { [key: string]: string }[]) {
    const { userId, password } = this.extractLogin(...objs);
    const user = await this.login(userId, password);
    const serial = await this.source.serialize(user);
    return { user, serial };
  }

  async login(userId: string, password: string): Promise<U> {
    const p = this.source.principal;

    try {
      const user = await this.source.login(userId, password);
      this.context = this.source.getContext(user);
      return user;
    } catch (err) {
      throw new Error(ERR_INVALID_CREDS);
    }
  }

  async logout() {
    this.context = undefined;
  }

  async loadContext(id: string) {
    const user = await this.source.deserialize(id);
    this.context = this.source.getContext(user);
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
