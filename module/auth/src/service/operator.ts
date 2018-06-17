import { ExpressOperator, ExpressApp } from '@travetto/express';
import { Injectable } from '@travetto/di';
import { Request } from 'express';
import { AuthService } from './auth';
import { AUTH } from './types';

@Injectable({
  target: ExpressOperator,
  qualifier: AUTH
})
export class AuthOperator extends ExpressOperator {

  constructor(private service: AuthService) {
    super();
  }

  operate(app: ExpressApp) {
    app.get().use(async (req, res, next) => {

      const r = req as Request;

      r.auth = this.service;
      this.service.loadContext(r);

      if (next) {
        next();
      }
    });
  }
}