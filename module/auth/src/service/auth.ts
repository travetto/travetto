import { Request, Response } from 'express';
import * as util from 'util';

import { AppError, ExpressOperator, ExpressApp } from '@travetto/express';
import { Injectable, Inject } from '@travetto/di';
import { Context } from '@travetto/context';
import { AuthSource } from '../source';

export const AUTH = Symbol('@travetto/auth');

export interface AuthContext<U> {
  id: string;
  permissions: Set<string>;
  principal: U;
}

@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class AuthOperator<U = { id: string }> extends ExpressOperator {

  @Inject()
  protected _context: Context;

  constructor(protected source: AuthSource<U>) {
    super();

    if (source.changePassword) {
      this.changePassword =
        (rq: Request, rs: Response, id: string, pw: string, oldpw?: string) => source.changePassword!(id, pw, oldpw);
    }

    if (source.register) {
      this.register = (rq: Request, rs: Response, user: U) => source.register!(user);
    }
  }

  get context() {
    return this._context.get().auth;
  }

  set context(ctx: AuthContext<U>) {
    this._context.get().auth = ctx;
  }

  get unauthenticated() {
    return !this.context;
  }

  async login(req: Request, res: Response): Promise<U> {
    const idField = this.source.principalProvider.idField;
    const pwField = this.source.principalProvider.passwordField;

    try {
      const userId = req.body ? req.body[idField] : req.query[idField];
      const password = req.body ? req.body[pwField] : req.query[pwField];

      const user = await this.source.login(userId, password);
      req.session.authToken = await this.source.serialize(user);

      (req as any as { auth: AuthOperator }).auth.context = req.session.authContext = this.source.getContext(user);

      return user;
    } catch (err) {
      throw new AppError(`Unable to authenticate, ${idField}/${pwField} combination are invalid`);
    }
  }

  async logout(req: Request, res: Response) {
    await util.promisify(req.session.destroy).call(req.session);
    res.clearCookie('connect.sid', { path: '/' });
  }

  register?(req: Request, res: Response, user: U): Promise<U>;
  changePassword?(req: Request, res: Response, userId: string, password: string, oldpassword: string): Promise<U>;

  operate(app: ExpressApp) {
    app.get().use(async (req, res, next) => {

      (req as any as { auth: AuthOperator<U> }).auth = this;

      if (req.session.authToken) {
        this.context = this.source.getContext(await this.source.deserialize(req.session.authToken));
      }

      if (next) {
        next();
      }
    });
  }
}