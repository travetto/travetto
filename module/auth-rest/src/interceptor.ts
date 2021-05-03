import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { Principal } from '@travetto/auth';

import { PrincipalEncoder } from './encoder';

/**
 * Authentication interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Connects the principal to the request
 */
@Injectable()
export class AuthInterceptor implements RestInterceptor {

  @Inject()
  encoder: PrincipalEncoder;

  async intercept(req: Request, res: Response, next: () => Promise<unknown>) {
    let og: Principal | undefined;
    try {
      og = req.auth = await this.encoder.decode(req);
      return await next();
    } finally {
      if (og !== req.auth || (req.auth && og && og.expiresAt !== req.auth.expiresAt)) { // If it changed
        await this.encoder.encode(req, res, req.auth);
      }
      req.auth = undefined;
    }
  }
}