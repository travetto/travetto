import { Controller, Get, Post, Redirect, Context, Request } from '@travetto/rest';
import { Authenticate, Authenticated, Unauthenticated } from '@travetto/auth-rest';
import { AuthContext } from '@travetto/auth';

import { BASIC } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class ApiController {

  @Post('/login')
  @Authenticate(BASIC)
  async getAll() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(@Context() auth: AuthContext) {
    return auth;
  }

  @Get('/logout')
  @Unauthenticated()
  async logout(@Context() req: Request) {
    await req.logout();
    return new Redirect('/auth/self', 301);
  }
}