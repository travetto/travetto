import * as passport from 'passport';

import { ExpressOperator, ExpressApp } from '@travetto/express';
import { Injectable } from '@travetto/di';

@Injectable()
export class AuthPassportOperator extends ExpressOperator {

  constructor() {
    super();
    this.priority = 200;
  }

  async operate(app: ExpressApp) {
    const e = app.get();
    e.use(passport.initialize());
    e.use(passport.session());
  }
}