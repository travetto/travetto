import { RestInterceptor, Request, Response } from '@travetto/rest';
import { SessionInterceptor } from '@travetto/rest-session';
import { Injectable, Inject } from '@travetto/di';
import { ContextInterceptor } from '@travetto/context/src/extension/rest.ext';

import { AuthService } from './service';
import { AuthRequestAdapter } from './adapter';
import { AuthContextStore } from './state';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  after = [ContextInterceptor, SessionInterceptor];

  @Inject()
  service: AuthService;

  @Inject()
  contextStore: AuthContextStore;

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const auth = req.auth = new AuthRequestAdapter();

    try {
      auth.context = await this.contextStore.read(req);

      req.authenticate = this.service.authenticate.bind(this.service, req, res);

      this.service.registerContext(req);

      return await next();
    } finally {
      await this.contextStore.write(req, res, auth.context);
    }
  }
}