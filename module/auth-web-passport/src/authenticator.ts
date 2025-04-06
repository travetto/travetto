import passport from 'passport';

import { Authenticator, AuthenticatorState, Principal } from '@travetto/auth';
import { WebFilterContext } from '@travetto/web';
import { WebConnectUtil } from '@travetto/web-connect';

import { PassportUtil } from './util.ts';

type SimplePrincipal = Omit<Principal, 'issuedAt' | 'expiresAt'>;
type PassportUser = Express.User & { _raw?: unknown, _json?: unknown, source?: unknown };

/**
 * Authenticator via passport
 */
export class PassportAuthenticator<V extends PassportUser = PassportUser> implements Authenticator<object, WebFilterContext> {

  #strategyName: string;
  #strategy: passport.Strategy;
  #toPrincipal: (user: V, issuer?: string) => SimplePrincipal;
  #passportOptions: (ctx: WebFilterContext) => passport.AuthenticateOptions;
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
    toPrincipal: (user: V) => SimplePrincipal,
    opts: passport.AuthenticateOptions | ((ctx: WebFilterContext) => passport.AuthenticateOptions) = {},
  ) {
    this.#strategyName = strategyName;
    this.#strategy = strategy;
    this.#toPrincipal = toPrincipal;
    this.#passportOptions = typeof opts === 'function' ? opts : ((): Partial<passport.AuthenticateOptions> => opts);
    passport.use(this.#strategyName, this.#strategy);
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
  async authenticate(input: object, ctx: WebFilterContext): Promise<Principal | undefined> {
    const requestOptions = this.#passportOptions(ctx);
    const options = {
      session: this.session,
      failWithError: true,
      ...requestOptions,
      state: PassportUtil.enhanceState(ctx, requestOptions.state)
    };

    const user = await WebConnectUtil.invoke<V>(ctx, (req, res, next) =>
      passport.authenticate(this.#strategyName, options, next)(req, res)
    );

    if (user) {
      delete user._raw;
      delete user._json;
      delete user.source;
      return this.#toPrincipal(user, this.#strategyName);
    }
  }
}