import * as express from 'express';
import * as passport from 'passport';

import { ExpressOperator } from '@travetto/express';
import { Injectable } from '@travetto/di';
import { AuthOperator } from '@travetto/auth-express/src';

@Injectable()
export class AuthPassportOperator extends ExpressOperator {

  after = AuthOperator;

  async operate(app: express.Application) {
    app.use(passport.initialize());
    app.use(passport.session());
  }
}