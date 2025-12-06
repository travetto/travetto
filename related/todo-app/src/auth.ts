import { Controller, Get, Post, ContextParam, WebResponse } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { BasicAuthSymbol } from './auth.config';

/**
 * Auth API
 */
@Controller('/auth')
export class AuthController {

  @ContextParam()
  user: Principal;

  @Post('/login')
  @Login(BasicAuthSymbol)
  async login(): Promise<WebResponse<void>> {
    return WebResponse.redirect('/auth/self');
  }


  @Get('/self')
  @Authenticated()
  async getSelf(): Promise<Principal> {
    return this.user;
  }

  @Get('/logout')
  @Logout()
  async logout(): Promise<WebResponse<void>> {
    return WebResponse.redirect('/auth/self');
  }
}