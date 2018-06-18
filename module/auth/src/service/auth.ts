import { Inject } from '@travetto/di';
import { Context } from '@travetto/context';
import { AuthProvider } from '../provider';
import { AuthContext, ERR_UNAUTHENTICATED, ERR_FORBIDDEN, ERR_INVALID_CREDS } from '../types';

export class AuthService<U = { id: string }> {

  @Inject()
  protected _context: Context;

  constructor(public provider: AuthProvider<U>) { }

  private extractLogin(...objs: { [key: string]: string }[]) {
    const idField = this.provider.principal.fields.id;
    const pwField = this.provider.principal.fields.password;

    const valid = (objs.find(x => idField in x) || {}) as any as U;

    return {
      userId: valid[idField] as any as string,
      password: valid[pwField] as any as string
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
    const serial = await this.provider.serialize(user);
    return { user, serial };
  }

  async login(userId: string, password: string): Promise<U> {
    const p = this.provider.principal;

    try {
      const user = await this.provider.login(userId, password);
      this.context = this.provider.getContext(user);
      return user;
    } catch (err) {
      throw new Error(ERR_INVALID_CREDS);
    }
  }

  async logout() {
    this.context = undefined;
  }

  async loadContext(id: string) {
    const user = await this.provider.deserialize(id);
    this.context = this.provider.getContext(user);
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
