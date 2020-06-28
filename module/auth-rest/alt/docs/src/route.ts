import { Controller, Get, Redirect, Request } from '@travetto/rest';

import { Authenticate, Authenticated } from '../../..';
import { FB_AUTH } from './facebook';

@Controller('/auth')
export class SampleAuth {

  @Get('/simple')
  @Authenticate(FB_AUTH)
  async simpleLogin() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth.principal;
  }

  @Get('/logout')
  @Authenticated()
  async logout(req: Request) {
    await req.logout();
    return new Redirect('/auth/self', 301);
  }
}