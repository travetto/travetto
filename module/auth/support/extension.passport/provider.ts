import { Request, Response } from 'express';
import * as passport from 'passport';

import { AuthProvider } from '../extension.express/provider';
import { PrincipalConfig, AuthContext } from '../../src';

export class AuthPassportProvider<U> extends AuthProvider<U> {
  constructor(private strategyName: string, private strategy: passport.Strategy, private principal: PrincipalConfig<U>) {
    super();
    passport.use(this.strategyName, this.strategy);
  }

  async login(req: Request, res: Response) {
    return new Promise<AuthContext<U> | undefined>((resolve, reject) => {
      passport.authenticate(this.strategyName, (err, user, ...rest) => {
        console.log('Successfully logged in', user, rest);
        if (err) {
          reject(err);
        } else {
          resolve(this.principal.toContext(user));
        }
      })(req, res);
    });
  }
}