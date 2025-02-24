import passport from 'passport';

import { Authenticator, AuthenticatorState, Principal } from '@travetto/auth';
import { FilterContext, Request, Response } from '@travetto/rest';
import { castTo } from '@travetto/runtime';

import { PassportUtil } from './util.ts';

type SimplePrincipal = Omit<Principal, 'issuedAt' | 'expiresAt'>;

type Handler = (req: Request, res: Response, next: Function) => unknown;
const authenticator: passport.Authenticator<Handler> = castTo(passport);

/**
 * Authenticator via passport
 */
export class PassportAuthenticator<U extends object> implements Authenticator<U, FilterContext> {

  #passportInit = authenticator.initialize();

  #init?: Promise<void>;
  #strategyName: string;
  #strategy: passport.Strategy;
  #toPrincipal: (user: U) => SimplePrincipal;
  #passportOptions: (req: Request) => passport.AuthenticateOptions;
  session = false;

  /**
   * Creating a new PassportAuthenticator
   *
   * @param strategyName Name of passport strategy
   * @param strategy  A passport strategy
   * @param toPrincipal  How to convert a user to an identity
   * @param opts Extra passport options
   */
  constructor(
    strategyName: string,
    strategy: passport.Strategy,
    toPrincipal: (user: U) => SimplePrincipal,
    opts: passport.AuthenticateOptions | ((req: Request) => passport.AuthenticateOptions) = {},
  ) {
    this.#strategyName = strategyName;
    this.#strategy = strategy;
    this.#toPrincipal = toPrincipal;
    this.#passportOptions = typeof opts === 'function' ? opts : ((): Partial<passport.AuthenticateOptions> => opts);
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
      const du: U & { _json?: unknown, _raw?: unknown, source?: unknown } = user;
      delete du._json;
      delete du._raw;
      delete du.source;

      const p = this.#toPrincipal(user);
      p.issuer ??= this.#strategyName;
      return p;
    }
  }

  /**
   * Extract the passport auth context
   */
  getState(context?: FilterContext | undefined): AuthenticatorState | undefined {
    return PassportUtil.readState<AuthenticatorState>(context!.req);
  }

  /**
   * Authenticate a request given passport config
   * @param ctx The travetto filter context
   */
  async authenticate(input: U, { req, res }: FilterContext): Promise<Principal | undefined> {
    const requestOptions = this.#passportOptions(req);

    await (this.#init ??= new Promise<void>(resolve => this.#passportInit(req, res, resolve)));

    return new Promise<Principal | undefined>((resolve, reject) => {
      const filter = passport.authenticate(this.#strategyName,
        {
          session: this.session,
          ...requestOptions,
          state: PassportUtil.enhanceState(req, requestOptions.state)
        },
        (err: Error, u: U) => this.#authHandler(err, u).then(resolve, reject));

      filter(req, res);
    });
  }
}