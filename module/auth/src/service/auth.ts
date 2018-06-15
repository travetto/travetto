/// <reference path="../typings.d.ts" />

import { Request, Response, NextFunction } from 'express';
import * as util from 'util';

import { AppError, ExpressOperator, ExpressApp } from '@travetto/express';
import { Injectable, Inject } from '@travetto/di';
import { Context } from '@travetto/context';
import { AuthSource } from '../source';

export const AUTH = Symbol('@travetto/auth');

@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class AuthOperator<U = { id: string }> extends ExpressOperator {

  @Inject()
  protected context: Context;

  constructor(protected source: AuthSource<U>) {
    super();

    if (source.register) {
      this.register = async (user: U, password: string) => {
        const res = await this.source.register!(user, password);

        try {
          this.context.get().principal = res;
        } catch (e) {
          // Do nothing
        }

        return res;
      };
    }
    if (source.changePassword) {
      this.changePassword = source.changePassword.bind(source);
    }
  }

  async login(req: Request, res: Response, userId: string, password: string): Promise<U> {
    try {
      const user = await this.source.login(userId, password);
      this.context.get().user = user;
      req.session.principal = this.source;

      return user;
    } catch (err) {
      throw new AppError('Unable to authenticate, userId/password combination are invalid');
    }
  }

  async logout(req: Request, res: Response) {
    await util.promisify(req.session.destroy).call(req.session);
    res.clearCookie('connect.sid', { path: '/' });
  }

  async filterAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const idField = this.source.principalProvider.idField;
      const pwField = this.source.principalProvider.passwordField;
      const userId = req.body ? req.body[idField] : req.query[idField];
      const password = req.body ? req.body[pwField] : req.query[pwField];

      await this.login(req, res, userId, password);
      next();
    } catch (err) {
      next(err);
    }
  }

  operate(app: ExpressApp) {
    app.get().use((req, res, next) => {
      this.context.get().principal = req.principal;

      req.logout = () => this.logout(req, res);

      if (next) {
        next();
      }
    });
  }

  register?(user: U, password: string): Promise<U>;

  changePassword?(userId: string, password: string, oldPassword?: string): Promise<U>;
}