import * as passport from 'passport';

import { RestInterceptor, Request, Response, ManagedInterceptorConfig, FilterContext } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { AuthReadWriteInterceptor } from '@travetto/auth-rest';
import { Config } from '@travetto/config';

type Handler = (req: Request, res: Response, next: Function) => unknown;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const authenticator = (passport as unknown as passport.Authenticator<Handler>);

@Config('rest.auth.passport')
export class RestPassportConfig extends ManagedInterceptorConfig { }

/**
 * Passport rest interceptor
 */
@Injectable()
export class AuthPassportInterceptor implements RestInterceptor {

  #init = authenticator.initialize();

  after = [AuthReadWriteInterceptor];

  @Inject()
  config: RestPassportConfig;

  // TODO: Limit to necessary paths
  async intercept({ req, res }: FilterContext): Promise<void> {
    await new Promise<void>((resolve) => this.#init(req, res, resolve));
  }
}