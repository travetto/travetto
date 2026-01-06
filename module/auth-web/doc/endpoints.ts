import { Controller, Get, ContextParam, WebResponse } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import type { Principal } from '@travetto/auth';

import { FbAuthSymbol } from './facebook.ts';

@Controller('/auth')
export class SampleAuth {

  @ContextParam()
  user: Principal;

  @Get('/simple')
  @Login(FbAuthSymbol)
  async simpleLogin() {
    return WebResponse.redirect('/auth/self');
  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.user;
  }

  @Get('/logout')
  @Logout()
  async logout() {
    return WebResponse.redirect('/auth/self');
  }
}