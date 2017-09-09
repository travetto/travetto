import * as passport from 'passport';
import { Request, Response } from 'express';

import { Context } from '@encore2/context';
import { Injectable } from '@encore2/di';
import { ExpressApp, ExpressOperator } from '@encore2/express';
import { nodeToPromise } from '@encore2/base';

import { AuthConfig } from './config';
import { BaseStrategy } from './strategy';

@Injectable({
  target: ExpressOperator,
  name: '@encore2/auth'
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
    await nodeToPromise(req.session, req.session.destroy);
    res.clearCookie('connect.sid', { path: '/' });
  }
}