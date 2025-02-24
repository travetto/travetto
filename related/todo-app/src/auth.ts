import { Controller, Get, Post, Redirect } from '@travetto/rest';
import { Login, Authenticated, Logout } from '@travetto/auth-rest';
import { Principal } from '@travetto/auth';

import { BasicAuthSymbol, User } from './auth.config.ts';

/**
 * Auth API
 */
@Controller('/auth')
export class AuthController {

  @Post('/login')
  @Login(BasicAuthSymbol)
  async login(user: User): Promise<Redirect> {
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