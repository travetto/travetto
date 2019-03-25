import { AuthContext } from '@travetto/auth';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { SessionInterceptor } from '@travetto/rest-session';
import { Injectable, Inject } from '@travetto/di';
import { ContextInterceptor } from '@travetto/context/src/extension/rest.ext';

import { AuthService } from './service';
import { AuthContextEncoder } from './encoder';

const CTX = Symbol('auth-ctx');

@Injectable()
export class AuthInterceptor extends RestInterceptor {

  after = [ContextInterceptor, SessionInterceptor];

  @Inject()
  service: AuthService;

  @Inject()
  contextStore: AuthContextEncoder;

  async configure(req: Request, res: Response) {
    Object.defineProperties(req, {
      auth: {
        get() { return (req as any)[CTX]; },
        set(ctx: AuthContext) { (req as any)[CTX] = ctx; },
        enumerable: true,
        configurable: true,
      }
    });

    req.logout = async () => { delete req.auth.principal; };
    req.authenticate = this.service.authenticate.bind(this.service, req, res);

    req.auth = (await this.contextStore.read(req)) || new AuthContext(null as any);
  }

  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    try {
      await this.configure(req, res);

      this.service.registerContext(req);

      return await next();
    } finally {
      await this.contextStore.write(req, res);
    }
  }
}