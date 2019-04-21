import { AuthContext } from '@travetto/auth';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';

import { AuthContextService } from './context';
import { AuthContextEncoder, HeaderAuthContextEncoder } from './encoder';
import { AuthService } from './auth';

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  @Inject()
  context: AuthContextService;

  @Inject()
  service: AuthService;

  @Inject({ defaultIfMissing: HeaderAuthContextEncoder })
  contextStore: AuthContextEncoder;

  async configure(req: Request, res: Response) {
    req.logout = async function () { delete this.auth.principal; };
    req.login = async (providers: symbol[]) => {
      const ctx = await this.service.login(req, res, providers);
      if (ctx) {
        this.context.set(ctx, req);
      }
      return ctx;
    };
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