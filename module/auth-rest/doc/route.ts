import { Controller, Get, Redirect, Request } from '@travetto/rest';
import { Login, Authenticated, Logout } from '@travetto/auth-rest';

import { FB_AUTH } from './facebook.ts';

@Controller('/auth')
export class SampleAuth {

  @Get('/simple')
  @Login(FB_AUTH)
  async simpleLogin() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/logout')
  @Logout()
  async logout() {
    return new Redirect('/auth/self', 301);
  }
}