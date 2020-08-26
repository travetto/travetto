import { AuthContext } from '@travetto/auth';
import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable, Inject } from '@travetto/di';

import { AuthContextService } from './context';
import { AuthContextEncoder } from './encoder';
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
    require('@travetto/context').AsyncContextInterceptor, // @line-if @travetto/context
    require('@travetto/rest-session').SessionInterceptor, // @line-if @travetto/rest-session
  ];

  @Inject()
  context: AuthContextService;

  @Inject()
  service: AuthService;

  @Inject()
  contextStore?: AuthContextEncoder;


  /**
   * Determines the current route is applicable for the interceptor
   * @param route The route to check
   * @param controller The controller the route belongs to
   */
  applies() {
    return !!this.contextStore;
  }


  async configure(req: Request, res: Response) {
    req.logout = async function () { delete this.auth; };
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
      const ctx = (await this.contextStore!.read(req))
        || new AuthContext(undefined as any);
      this.context.set(ctx, req);

      await this.configure(req, res);
      return await next();
    } finally {
      if (req.auth && req.auth.principal) {
        await this.contextStore!.write(req.auth, req, res);
      }
      this.context.clear();
    }
  }
}