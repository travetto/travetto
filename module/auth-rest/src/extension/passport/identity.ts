// @file-if passport
import * as passport from 'passport';

import { Identity } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';
import { Util } from '@travetto/base';

import { IdentitySource } from '../../identity';

interface PassportAuthOptions {
  state?: ((req: Request) => Record<string, unknown>) | Record<string, unknown>;
}

/**
 * Identity source via passport
 */
export class PassportIdentitySource<U> implements IdentitySource {

  /**
   * Process request read state from query
   * @param req The travetto request
   */
  static #processLoginContext(req: Request) {
    if (req.query.state) {
      if (typeof req.query.state === 'string' && req.query.state) {
        try {
          return JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
        } catch {
          console.error('Unable to process previous login state');
        }
      }
    }
  }

  /**
   * Compute extra passport options, convert state to a base64 value
   * @param req The travetto request,
   * @param state The passport auth config state
   */
  static #processExtraOptions(req: Request, { state }: PassportAuthOptions): Partial<passport.AuthenticateOptions> {
    const stateRec = Util.isFunction(state) ? state.call(null, req) : (state ?? {});
    const json = JSON.stringify({ referrer: req.header('referrer'), ...stateRec });

    return {
      state: Buffer.from(json).toString('base64')
    };
  }

  #strategyName: string;
  #strategy: passport.Strategy;
  #toIdentity: (user: U) => Pick<Identity, 'id' | 'permissions' | 'details'> & { issuer?: string };
  #passportAuthenticateOptions: passport.AuthenticateOptions;
  #extraOptions: PassportAuthOptions;
  session = false;


  /**
   * Creating a new PassportIdentitySource
   *
   * @param strategyName Name of passport strategy
   * @param strategy  A passport strategy
   * @param toIdentity  How to convert a user to an identity
   * @param passportAuthenticateOptions Extra passport options
   */
  constructor(
    strategyName: string,
    strategy: passport.Strategy,
    toIdentity: (user: U) => Pick<Identity, 'id' | 'permissions' | 'details'> & { issuer?: string },
    passportAuthenticateOptions: passport.AuthenticateOptions = {},
    extraOptions: PassportAuthOptions = {}
  ) {
    this.#strategyName = strategyName;
    this.#strategy = strategy;
    this.#toIdentity = toIdentity;
    this.#passportAuthenticateOptions = passportAuthenticateOptions;
    this.#extraOptions = extraOptions;
    passport.use(this.#strategyName, this.#strategy);
  }

  /**
   * Authenticate a request given passport config
   * @param req The travetto request
   * @param res The travetto response
   */
  async authenticate(req: Request, res: Response) {
    return new Promise<Identity | undefined>((resolve, reject) => {

      // Get the login context
      req.loginContext = PassportIdentitySource.#processLoginContext(req);

      const filter = passport.authenticate(this.#strategyName,
        {
          session: this.session,
          ...this.#passportAuthenticateOptions,
          ...PassportIdentitySource.#processExtraOptions(req, this.#extraOptions)
        },
        (err, u) => this.authHandler(err, u).then(resolve, reject));

      filter(req, res);
    });
  }

  /**
   * Handler for auth context
   * @param err A possible error from authentication
   * @param user The authenticated user
   */
  async authHandler(err: Error | undefined, user: U) {
    if (err) {
      throw err;
    } else {
      // Remove profile fields from passport
      const du = user as U & { _json: unknown, _raw: unknown, source: unknown };
      delete du._json;
      delete du._raw;
      delete du.source;

      const ident = this.#toIdentity(user);

      if (!ident.issuer) {
        ident.issuer = this.#strategyName;
      }
      return ident as Identity;
    }
  }
}