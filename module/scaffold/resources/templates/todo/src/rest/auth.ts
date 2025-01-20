import { Controller, Get, Post, Redirect, Request } from '@travetto/rest';
import { Authenticate, Authenticated, LoginService, Unauthenticated } from '@travetto/auth-rest';
import { Principal } from '@travetto/auth';
import { Inject } from '@travetto/di';

import { BasicAuthSymbol } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class ApiController {

  @Inject()
  svc: LoginService;

  @Post('/login')
  @Authenticate(BasicAuthSymbol)
  async getAll(): Promise<Redirect> {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(user: Principal): Promise<Principal> {
    return user;
  }

  @Get('/logout')
  @Unauthenticated()
  async logout(req: Request): Promise<Redirect> {
    await this.svc.logout(req);
    return new Redirect('/auth/self', 301);
  }
}