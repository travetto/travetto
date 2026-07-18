import type { Principal } from '@travetto/auth';
import { Authenticated, Login, Logout } from '@travetto/auth-web';
import { ContextParam, Controller, Get, Post, WebResponse } from '@travetto/web';

import { BasicAuthSymbol } from './auth.config.ts';

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
