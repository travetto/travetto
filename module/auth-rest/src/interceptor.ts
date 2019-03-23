import { RestInterceptor, Request, Response } from '@travetto/rest';
import { SessionInterceptor } from '@travetto/rest-session';
import { Injectable, Inject } from '@travetto/di';
import { ContextInterceptor } from '@travetto/context/src/extension/rest.ext';

import { AuthService } from './service';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  after = [ContextInterceptor, SessionInterceptor];

  @Inject()
  service: AuthService;

  async intercept(req: Request, res: Response, next: () => Promise<any>) {

    req.session.context = {};

    await this.service.restore(req, res);

    // Expose request api
    req.auth = {
      get principal() { return req.session.context.principal; },
      get principalDetails() { return req.session.context.principalDetails; },
      get permissions() { return req.session.context.permissions; },
      async updatePrincipalDetails(val: any) { req.session.context.updatePrincipalDetails(val); },
      logout: this.service.clearAuthContext.bind(this.service, req, res),
      authenticate: this.service.authenticate.bind(this.service, req, res)
    };

    const result = await next();

    return result;
  }
}