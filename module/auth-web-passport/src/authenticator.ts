import passport from 'passport';

import { Authenticator, AuthenticatorState, Principal } from '@travetto/auth';
import { WebFilterContext, WebRequest } from '@travetto/web';

import { PassportUtil } from './util.ts';
import { ConnectRequest, ConnectResponse } from './connect.ts';

type SimplePrincipal = Omit<Principal, 'issuedAt' | 'expiresAt'>;

/**
 * Authenticator via passport
 */
export class PassportAuthenticator<U extends object> implements Authenticator<U, WebFilterContext> {

  #strategyName: string;
  #strategy: passport.Strategy;
  #toPrincipal: (user: U) => SimplePrincipal;
  #passportOptions: (req: WebRequest) => passport.AuthenticateOptions;
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
    opts: passport.AuthenticateOptions | ((req: WebRequest) => passport.AuthenticateOptions) = {},
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
      // @ts-expect-error
      p.issuer ??= this.#strategyName;
      return p;
    }
  }

  /**
   * Extract the passport auth context
   */
  getState(context?: WebFilterContext | undefined): AuthenticatorState | undefined {
    return PassportUtil.readState<AuthenticatorState>(context!.req);
  }

  /**
   * Authenticate a request given passport config
   * @param ctx The travetto filter context
   */
  async authenticate(input: U, { req }: WebFilterContext): Promise<Principal | undefined> {
    const requestOptions = this.#passportOptions(req);

    const connectReq = new ConnectRequest(req);
    const connectRes = new ConnectResponse();

    const principal = await new Promise<Principal | undefined>((resolve, reject) => {
      const filter = passport.authenticate(this.#strategyName,
        {
          session: this.session,
          failWithError: true,
          ...requestOptions,
          state: PassportUtil.enhanceState(req, requestOptions.state)
        },
        (err: Error, u: U) => this.#authHandler(err, u).then(resolve, reject));

      filter(connectReq, connectRes);
    });

    if (!principal) {
      connectRes.throwIfSent();
    }

    return principal;
  }
}