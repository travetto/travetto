import { Controller, Get, Redirect, HttpRequest } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';

import { FB_AUTH } from './facebook';

@Controller('/auth')
export class SampleAuth {

  @Get('/simple')
  @Login(FB_AUTH)
  async simpleLogin() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: HttpRequest) {
    return req.user;
  }

  @Get('/logout')
  @Logout()
  async logout() {
    return new Redirect('/auth/self', 301);
  }
}