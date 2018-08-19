import * as passport from 'passport';

import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable } from '@travetto/di';
import { AuthInterceptor } from '../../src';

interface Handler {
  (req: Request, res: Response, next: Function): any;
}

const authenticator = (passport as any as passport.Authenticator<Handler>);

@Injectable()
export class AuthPassportInterceptor extends RestInterceptor {

  private init = authenticator.initialize();
  private session = authenticator.session();

  after = AuthInterceptor;

  intercept(req: Request, res: Response) {
    return new Promise(resolve => {
      this.init(req, res, () => {
        this.session(req, res, resolve);
      });
    });
  }
}