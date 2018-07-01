import { ExpressOperator, ExpressApp } from '@travetto/express';
import { Injectable, Inject } from '@travetto/di';

import * as passport from 'passport';
import { AuthService, PrincipalConfig } from '../../src';

const PASSPORT = Symbol('@travetto/auth/passport');

@Injectable({
  target: ExpressOperator,
  qualifier: PASSPORT
})
export class AuthPassportOperator extends ExpressOperator {

  @Inject()
  private service: AuthService;

  constructor(private principal: PrincipalConfig) {
    super();
  }

  async operate(app: ExpressApp) {
    const e = app.get();
    e.use(passport.initialize());
    e.use(passport.session());
    e.use((req, res, next) => {
      // Load passport user into context
      this.service.context = this.principal.toContext(req.user);
      next();
    });
  }
}