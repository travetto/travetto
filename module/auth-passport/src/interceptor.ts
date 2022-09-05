import * as passport from 'passport';

import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable } from '@travetto/di';
import { AuthInterceptor } from '@travetto/auth-rest';

type Handler = (req: Request, res: Response, next: Function) => unknown;

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const authenticator = (passport as unknown as passport.Authenticator<Handler>);

/**
 * Passport rest interceptor
 */
@Injectable()
export class PassportInterceptor implements RestInterceptor {

  #init = authenticator.initialize();

  after = [AuthInterceptor];

  async intercept(req: Request, res: Response): Promise<void> {
    await new Promise<void>((resolve) => this.#init(req, res, resolve));
  }
}