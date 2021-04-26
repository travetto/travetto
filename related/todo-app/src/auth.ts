import { Controller, Get, Post, Redirect, Context, Request } from '@travetto/rest';
import { Authenticate, Authenticated, AuthService, Unauthenticated } from '@travetto/auth-rest';
import { Principal } from '@travetto/auth';
import { Inject } from '@travetto/di';

import { BasicAuthⲐ } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class ApiController {

  @Inject()
  svc: AuthService;

  @Post('/login')
  @Authenticate(BasicAuthⲐ)
  async getAll() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(@Context() user: Principal) {
    return user;
  }

  @Get('/logout')
  @Unauthenticated()
  async logout(@Context() req: Request) {
    await this.svc.logout(req);
    return new Redirect('/auth/self', 301);
  }
}