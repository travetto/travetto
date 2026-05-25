import { type Principal } from '@travetto/auth';
import { Authenticated, Login, Logout } from '@travetto/auth-web';
import { ContextParam, Controller, Get, Post, WebResponse } from '@travetto/web';

import { BasicAuthSymbol } from './auth.config.ts';

@Controller('/auth')
export class AuthController {

  @ContextParam()
  user: Principal;

  @Post('/login')
  @Login(BasicAuthSymbol)
  async login(): Promise<WebResponse> {
    return WebResponse.redirect('/auth/self');
  }

  @Get('/self')
  @Authenticated()
  async self(): Promise<Principal> {
    return this.user;
  }

  @Get('/logout')
  @Logout()
  async logout(): Promise<WebResponse> {
    return WebResponse.redirect('/auth/self');
  }
}
