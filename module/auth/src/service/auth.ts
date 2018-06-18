import { AppError } from '@travetto/express';
import { Inject } from '@travetto/di';
import { Context } from '@travetto/context';
import { AuthSource } from '../source';
import { AuthContext } from './types';

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
      throw new AppError(`Unable to authenticate, ${p.idField}/${p.passwordField} combination are invalid`);
    }
  }

  async logout() {
    this.context = undefined;
  }

  async loadContext(id: string) {
    const user = await this.source.deserialize(id);
    this.context = this.source.getContext(user);
  }
}
