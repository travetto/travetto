import { AuthService } from '@travetto/auth';
import { AuthInterceptor } from './interceptor';
import { Request, Response } from '@travetto/rest';

export class AuthServiceAdapter {
  constructor(
    private service: AuthService,
    private interceptor: AuthInterceptor,
    private req: Request,
    private res: Response
  ) { }

  get context() {
    return this.service.context;
  }

  get authenticated() {
    return this.service.authenticated;
  }

  get unauthenticated() {
    return this.service.unauthenticated;
  }

  checkPermissions(include: string[], exclude: string[]) {
    return this.service.checkPermissions(include, exclude);
  }

  async login(providers: symbol[]) {
    return await this.interceptor.login(this.req, this.res, providers);
  }

  async logout() {
    return await this.interceptor.logout(this.req, this.res);
  }

  updatePrincipalState(principal: any) {
    this.interceptor.updatePrincipalState(this.req, principal);
  }
}