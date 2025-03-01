import { Controller, Get, Post, Redirect } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { BasicAuthSymbol } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class ApiController {

  @Post('/login')
  @Login(BasicAuthSymbol)
  async getAll(): Promise<Redirect> {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(user: Principal): Promise<Principal> {
    return user;
  }

  @Get('/logout')
  @Logout()
  async logout(): Promise<Redirect> {
    return new Redirect('/auth/self', 301);
  }
}