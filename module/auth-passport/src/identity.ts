import * as passport from 'passport';

import { Identity } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { IdentityProvider } from '@travetto/auth-rest';

export class PassportIdentityProvider<U> extends IdentityProvider {
  session = false;

  constructor(
    private strategyName: string,
    private strategy: passport.Strategy,
    private toIdentity: (user: U) => Pick<Identity, 'id' | 'permissions' | 'details'> & { provider?: string },
    private passportAuthenticateOptions: any = {}
  ) {
    super();
    passport.use(this.strategyName, this.strategy);
  }

  async authenticate(req: Request, res: Response) {
    return new Promise<Identity | undefined>((resolve, reject) => {
      passport.authenticate(this.strategyName, { session: this.session, ...this.passportAuthenticateOptions },
        (err, u) => this.authHandler(err, u).then(resolve, reject))(req, res);
    });
  }

  async authHandler(err: Error | undefined, user: U) {
    if (err) {
      throw err;
    } else {
      // Remove profile fields from passport
      const du = user as U & { _json: any, _raw: any, provider: any };
      delete du._json;
      delete du._raw;
      delete du.provider;

      const ident = this.toIdentity(user);
      if (!ident.provider) {
        ident.provider = this.strategyName;
      }
      return ident as Identity;
    }
  }
}