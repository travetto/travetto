import * as passport from 'passport';

import { Authenticator, Principal } from '@travetto/auth';
import { FilterContext, Request, Response } from '@travetto/rest';
import { LoginContextⲐ } from '@travetto/auth-rest/src/internal/types';

import { PassportAuthOptions, PassportUtil } from './util';

type SimplePrincipal = Omit<Principal, 'issuedAt' | 'expiresAt'>;


type Handler = (req: Request, res: Response, next: Function) => unknown;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const authenticator = (passport as unknown as passport.Authenticator<Handler>);

/**
 * Authenticator via passport
 */
export class PassportAuthenticator<U> implements Authenticator<U, Principal, FilterContext> {

  #passportInit = authenticator.initialize();

  #init?: Promise<void>;
  #strategyName: string;
  #strategy: passport.Strategy;
  #toPrincipal: (user: U) => SimplePrincipal;
  #passportAuthenticateOptions: passport.AuthenticateOptions;
  #extraOptions: PassportAuthOptions;
  session = false;

  /**
   * Creating a new PassportAuthenticator
   *
   * @param strategyName Name of passport strategy
   * @param strategy  A passport strategy
   * @param toPrincipal  How to convert a user to an identity
   * @param passportAuthenticateOptions Extra passport options
   */
  constructor(
    strategyName: string,
    strategy: passport.Strategy,
    toPrincipal: (user: U) => SimplePrincipal,
    passportAuthenticateOptions: passport.AuthenticateOptions = {},
    extraOptions: PassportAuthOptions = {}
  ) {
    this.#strategyName = strategyName;
    this.#strategy = strategy;
    this.#toPrincipal = toPrincipal;
    this.#passportAuthenticateOptions = passportAuthenticateOptions;
    this.#extraOptions = extraOptions;
    passport.use(this.#strategyName, this.#strategy);
  }

  /**
   * Handler for auth context
   * @param err A possible error from authentication
   * @param user The authenticated user
   */
  async #authHandler(err: Error | undefined, user: U): Promise<Principal> {
    if (err) {
      throw err;
    } else {
      // Remove profile fields from passport
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const du = user as (U & { _json?: unknown, _raw?: unknown, source?: unknown });
      delete du._json;
      delete du._raw;
      delete du.source;

      const p = this.#toPrincipal(user);
      p.issuer ??= this.#strategyName;
      return p;
    }
  }

  /**
   * Setup passport for initialization
   * @param ctx The travetto filter context
   */
  initialize({ req, res }: FilterContext): Promise<void> {
    return this.#init ??= new Promise<void>(resolve => this.#passportInit(req, res, resolve));
  }

  /**
   * Authenticate a request given passport config
   * @param ctx The travetto filter context
   */
  authenticate(user: U, { req, res }: FilterContext): Promise<Principal | undefined> {
    return new Promise<Principal | undefined>((resolve, reject) => {

      // Get the login context
      req[LoginContextⲐ] = PassportUtil.getLoginContext(req);

      const filter = passport.authenticate(this.#strategyName,
        {
          session: this.session,
          ...this.#passportAuthenticateOptions,
          ...PassportUtil.createLoginContext(req, this.#extraOptions)
        },
        (err, u) => this.#authHandler(err, u).then(resolve, reject));

      filter(req, res);
    });
  }
}