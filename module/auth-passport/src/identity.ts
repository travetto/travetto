import * as passport from 'passport';

import { Identity } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { IdentityProvider } from '@travetto/auth-rest';

interface PassportAuthOptions {
  state?: ((req: Request) => any) | Record<string, any>;
}

/**
 * Identity provider via passport
 */
export class PassportIdentityProvider<U> extends IdentityProvider {

  /**
   * Process request read state from query
   */
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

  /**
   * Compute extra passport options, convert state to a base64 value
   */
  static processExtraOptions(req: Request, { state }: PassportAuthOptions): Partial<passport.AuthenticateOptions> {
    const stateRec = state && state.call ? state.call(null, req) : (state ?? {});
    const json = JSON.stringify({ referrer: req.header('referrer'), ...stateRec });

    return {
      state: Buffer.from(json, 'utf8').toString('base64')
    };
  }

  session = false;

  /**
   * Creating a new PassportIdentityProvider
   *
   * @param strategyName Name of passport strategy
   * @param strategy  A passport strategy
   * @param toIdentity  How to convert a user to an identity
   * @param passportAuthenticateOptions Extra passport options
   */
  constructor(
    private strategyName: string,
    private strategy: passport.Strategy,
    private toIdentity: (user: U) => Pick<Identity, 'id' | 'permissions' | 'details'> & { provider?: string },
    private passportAuthenticateOptions: passport.AuthenticateOptions = {},
    private extraOptions: PassportAuthOptions = {}
  ) {
    super();
    passport.use(this.strategyName, this.strategy);
  }

  /**
   * Authenticate a request given passport config
   */
  async authenticate(req: Request, res: Response) {
    return new Promise<Identity | undefined>((resolve, reject) => {

      // Get the login context
      req.loginContext = PassportIdentityProvider.processLoginContext(req);

      const filter = passport.authenticate(this.strategyName,
        {
          session: this.session,
          ...this.passportAuthenticateOptions,
          ...PassportIdentityProvider.processExtraOptions(req, this.extraOptions)
        },
        (err, u) => this.authHandler(err, u).then(resolve, reject));

      filter(req, res);
    });
  }

  /**
   * Handler for auth context
   */
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