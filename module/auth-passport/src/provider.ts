import * as passport from 'passport';

import { Identity } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { IdentityProvider } from '@travetto/auth-rest';

export class PassportIdentityProvider<U> extends IdentityProvider {
  constructor(
    private strategyName: string,
    private strategy: passport.Strategy,
    private toIdentity: (user: U) => Pick<Identity, 'id' | 'permissions' | 'details'> & { provider?: string }
  ) {
    super();
    passport.use(this.strategyName, this.strategy);
  }

  async authenticate(req: Request, res: Response) {
    return new Promise<Identity | undefined>((resolve, reject) => {
      passport.authenticate(this.strategyName, (err, user, ...rest) => {
        if (err) {
          reject(err);
        } else {
          // Remove profile fields from passport
          delete user._json;
          delete user._raw;
          delete user.provider;

          const ident = this.toIdentity(user);
          if (!ident.provider) {
            ident.provider = this.strategyName;
          }
          resolve(ident as Identity);
        }
      })(req, res);
    });
  }
}