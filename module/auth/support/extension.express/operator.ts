import * as util from 'util';
import { Request, Response } from 'express';

import { ExpressOperator, ExpressApp } from '@travetto/express';
import { Injectable } from '@travetto/di';

import { AuthService } from '../../src/service/auth';

export const AUTH = Symbol('@travetto/auth');

@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class AuthOperator extends ExpressOperator {

  constructor(private service: AuthService) {
    super();

    const src = service.provider;

    if (src.changePassword) {
      this.changePassword = src.changePassword.bind(src);
    }

    if (src.register) {
      this.register = src.register.bind(src);
    }

  }

  async login(userId: string, password: string) {
    return await this.service.login(userId, password);
  }

  async loginFromPayload(req: Request, res: Response) {
    const { user, serial } = await this.service.loginFromPayload(req.body, req.query);
    req.session._auth = serial;
    return user;
  }

  async logout(req: Request, res: Response) {
    this.service.logout();
    await util.promisify(req.session.destroy).call(req.session);
    res.clearCookie('connect.sid', { path: '/' });
  }

  async loadContext(req: Request) {
    if (req.session._auth) {
      this.service.loadContext(req.session._auth);
    }
  }

  get authenticated() {
    return this.service.authenticated;
  }

  get unauthenticated() {
    return this.service.unauthenticated;
  }

  checkPermissions(include: string[], exclude: string[]) {
    return this.service.checkPermissions(include, exclude);
  }

  register?<U>(user: U): Promise<U>;

  changePassword?(userId: string, password: string, oldpassword: string): Promise<any>;

  operate(app: ExpressApp) {
    app.get().use(async (req, res, next) => {

      const r = req as Request;

      r.auth = this;
      this.loadContext(r);

      if (next) {
        next();
      }
    });
  }
}