import * as passport from 'passport';

import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable } from '@travetto/di';
import { AuthInterceptor } from '../../src';

@Injectable()
export class AuthPassportInterceptor extends RestInterceptor {

  private init = passport.initialize();
  private session = passport.session();

  after = AuthInterceptor;

  async intercept(req: Request, res: Response, proceed: Function) {
    this.init(req, res, () => {
      this.session(req, res, () => proceed());
    });
  }
}