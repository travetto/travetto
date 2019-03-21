import { RestInterceptor, Request, Response, GetCacheInterceptor } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { ContextInterceptor } from '@travetto/context/src/extension/rest.ext';

import { AuthService } from './service';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  after = [ContextInterceptor, GetCacheInterceptor];

  @Inject()
  service: AuthService;

  async intercept(req: Request, res: Response, next: () => Promise<any>) {

    req.__authContext = {} as any;

    await this.service.restore(req, res);

    // Expose request api
    req.auth = {
      get principal() { return req.__authContext.principal; },
      get principalDetails() { return req.__authContext.principalDetails; },
      get permissions() { return req.__authContext.permissions; },
      async updatePrincipalDetails(val: any) { req.__authContext.updatePrincipalDetails(val); },
      logout: this.service.clearAuthContext.bind(this.service, req, res),
      authenticate: this.service.authenticate.bind(this.service, req, res)
    };

    const result = await next();

    await this.service.refresh(req, res);

    return result;
  }
}