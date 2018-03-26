import * as ctx from '@travetto/express/opt/context';

import * as passport from 'passport';
import * as util from 'util';

import { Request, Response } from 'express';

import { Context } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { ExpressApp, ExpressOperator } from '@travetto/express';

import { AuthConfig } from './config';
import { BaseStrategy } from './strategy';

export const AUTH = Symbol('@travetto/auth');

@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class ExpressAuthOperator extends ExpressOperator {
  constructor(
    private config: AuthConfig,
    private context: Context,
    private strategy: BaseStrategy<any, any>
  ) {
    super();
  }

  operate(app: ExpressApp) {
    passport.serializeUser(this.strategy.serialize.bind(this));
    passport.deserializeUser(this.strategy.deserialize.bind(this));
    passport.use('app', this.strategy);

    app.get()
      .use(passport.initialize(), passport.session())
      .use((req: Request, res: Response, next?: Function) => {
        req.principal = req.user as any;
        this.context.get().user = req.user;

        req.doLogout = this.logout.bind(this, req, res);

        if (next) {
          next();
        }
      });
  }

  async logout(req: Request, res: Response) {
    await util.promisify(req.session.destroy).call(req.session);
    res.clearCookie('connect.sid', { path: '/' });
  }
}