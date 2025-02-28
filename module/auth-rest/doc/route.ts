import { Controller, Get, Redirect, HttpRequest } from '@travetto/rest';
import { Login, Authenticated, Logout } from '@travetto/auth-rest';

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