import { Controller, Get, Redirect, Request } from '@travetto/rest';
import { Authenticate, Authenticated, AuthService } from '@travetto/auth-rest';

import { FB_AUTH } from './facebook';

@Controller('/auth')
export class SampleAuth {

  svc: AuthService;

  @Get('/simple')
  @Authenticate(FB_AUTH)
  async simpleLogin() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/logout')
  @Authenticated()
  async logout(req: Request) {
    await this.svc.logout(req);
    return new Redirect('/auth/self', 301);
  }
}