import { RestInterceptor, Request, Response, ContextProvider } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { PrincipalTarget } from '@travetto/auth/src/internal/types';

import { PrincipalEncoder } from './encoder';

/**
 * Authentication interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Connects the principal to the request
 */
@Injectable()
@ContextProvider(PrincipalTarget, (c, req) => req.auth)
export class AuthInterceptor implements RestInterceptor {

  @Inject()
  encoder: PrincipalEncoder;

  async intercept(req: Request, res: Response, next: () => Promise<unknown>) {
    try {
      req.auth = await this.encoder.decode(req);
      return await next();
    } finally {
      if (req.auth) {
        await this.encoder.encode(req, res, req.auth);
      }
      delete req.auth;
    }
  }
}