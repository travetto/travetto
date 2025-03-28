import { Controller, Get, Post, Redirect, ContextParam } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { BasicAuthSymbol, User } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class AuthController {

  @ContextParam()
  user: Principal;

  @Post('/login')
  @Login(BasicAuthSymbol)
  async login(user: User): Promise<Redirect> {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(): Promise<Principal> {
    return this.user;
  }

  @Get('/logout')
  @Logout()
  async logout(): Promise<Redirect> {
    return new Redirect('/auth/self', 301);
  }
}