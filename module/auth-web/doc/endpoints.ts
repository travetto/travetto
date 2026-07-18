import type { Principal } from '@travetto/auth';
import { Authenticated, Login, Logout } from '@travetto/auth-web';
import { ContextParam, Controller, Get, WebResponse } from '@travetto/web';

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
