import { Controller, Get, ContextParam, HttpResponse } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { FbAuthSymbol } from './facebook.ts';

@Controller('/auth')
export class SampleAuth {

  @ContextParam()
  user: Principal;

  @Get('/simple')
  @Login(FbAuthSymbol)
  async simpleLogin() {
    return HttpResponse.redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.user;
  }

  @Get('/logout')
  @Logout()
  async logout() {
    return HttpResponse.redirect('/auth/self', 301);
  }
}