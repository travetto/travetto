import { Controller, Get, Post, Redirect, Request } from '@travetto/rest';
import { Authenticate, Authenticated, Unauthenticated } from '@travetto/auth-rest';

import { BASIC } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class ApiController {

  @Post('/login')
  @Authenticate(BASIC)
  async getAll() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/logout')
  @Unauthenticated()
  async logout(req: Request) {
    await req.logout();
    return new Redirect('/auth/self', 301);
  }
}