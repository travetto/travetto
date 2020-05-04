import { AuthContext } from '@travetto/auth';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';
import { AsyncContextInterceptor } from '@travetto/context'; // @line-if @travetto/context
import { SessionInterceptor } from '@travetto/rest-session'; // @line-if @travetto/rest-session

import { AuthContextService } from './context';
import { AuthContextEncoder, HeaderAuthContextEncoder } from './encoder';
import { AuthService } from './auth';

/**
 * Authentication interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Provides functionality on the request for login/logout.
 * - Connects the AuthContext to the request
 */
@Injectable()
export class AuthInterceptor extends RestInterceptor {

  after = [
    AsyncContextInterceptor, // @line-if @travetto/context
    SessionInterceptor, // @line-if @travetto/rest-session
  ];

  @Inject()
  context: AuthContextService;

  @Inject()
  service: AuthService;

  @Inject({ defaultIfMissing: HeaderAuthContextEncoder })
  contextStore: AuthContextEncoder;

  async configure(req: Request, res: Response) {
    req.logout = async function () { delete this.auth.principal; };
    req.login = async (sources: symbol[]) => {
      const ctx = await this.service.login(req, res, sources);
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