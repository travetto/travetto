import * as passport from 'passport';

import { Identity } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { IdentityProvider } from '@travetto/auth-rest';

export class PassportIdentityProvider<U> extends IdentityProvider {

  static processLoginContext(req: Request) {
    if (req.query.state) {
      if (typeof req.query.state === 'string' && req.query.state) {
        try {
          const json = Buffer.from(req.query.state, 'base64').toString('utf8');
          return JSON.parse(json);
        } catch {
          console.error('Unable to process previous login state');
        }
      }
    }
  }

  static computeExtraOptions(req: Request, state?: any) {
    const extra: Record<string, any> = {};

    state = state && state.call ? state.call(null, req) : (state || {});
    const json = JSON.stringify({ referrer: req.header('referrer'), ...state });
    extra.state = Buffer.from(json, 'utf8').toString('base64');
    return extra;
  }

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

      req.loginContext = PassportIdentityProvider.processLoginContext(req);

      passport.authenticate(this.strategyName, {
        session: this.session,
        ...this.passportAuthenticateOptions,
        ...PassportIdentityProvider.computeExtraOptions(req, this.passportAuthenticateOptions.state)
      },
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