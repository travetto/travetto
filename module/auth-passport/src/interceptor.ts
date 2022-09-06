import * as passport from 'passport';

import { RestInterceptor, Request, Response, ManagedInterceptor, ManagedConfig } from '@travetto/rest';
import { Inject, Injectable } from '@travetto/di';
import { AuthInterceptor } from '@travetto/auth-rest';
import { Config } from '@travetto/config';

type Handler = (req: Request, res: Response, next: Function) => unknown;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const authenticator = (passport as unknown as passport.Authenticator<Handler>);

@Config('rest.passport')
export class PassportConfig extends ManagedConfig { }

/**
 * Passport rest interceptor
 */
@Injectable()
@ManagedInterceptor()
export class PassportInterceptor implements RestInterceptor {

  #init = authenticator.initialize();

  after = [AuthInterceptor];

  @Inject()
  config: PassportConfig;

  async intercept(req: Request, res: Response): Promise<void> {
    await new Promise<void>((resolve) => this.#init(req, res, resolve));
  }
}