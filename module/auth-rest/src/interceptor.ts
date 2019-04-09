import { AuthContext } from '@travetto/auth';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';

import { AuthContextService } from './context';
import { AuthContextEncoder, SessionAuthContextEncoder } from './encoder';
import { AuthenticationService } from './authenticate';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  @Inject()
  context: AuthContextService;

  @Inject()
  service: AuthenticationService;

  @Inject({ defaultIfMissing: SessionAuthContextEncoder })
  contextStore: AuthContextEncoder;

  async configure(req: Request, res: Response) {
    req.logout = async function () { delete this.auth.principal; };
    req.authenticate = this.service.authenticate.bind(this.service, req, res);
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    try {
      const ctx = (await this.contextStore.read(req)) || new AuthContext(null as any);
      this.context.set(ctx, req);

      await this.configure(req, res);
      return await next();
    } finally {
      await this.contextStore.write(req.auth, req, res);
      this.context.clear();
    }
  }
}