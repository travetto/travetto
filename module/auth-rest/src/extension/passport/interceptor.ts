// @file-if passport
import * as passport from 'passport';

import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable } from '@travetto/di';

import { AuthInterceptor } from '../../interceptor';

type Handler = (req: Request, res: Response, next: Function) => unknown;

// @ts-expect-error
const authenticator = (passport as passport.Authenticator<Handler>);

/**
 * Passport rest interceptor
 */
@Injectable()
export class PassportInterceptor implements RestInterceptor {

  #init = authenticator.initialize();

  after = [AuthInterceptor];

  async intercept(req: Request, res: Response) {
    await new Promise<void>((resolve) => this.#init(req, res, resolve));
  }
}