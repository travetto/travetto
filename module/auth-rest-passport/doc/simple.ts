import { Controller, Get, Redirect, Post, Request } from '@travetto/rest';
import { Login, Authenticated, Logout } from '@travetto/auth-rest';

import { FB_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

  @Get('/name')
  async getName() {
    return { name: 'bob' };
  }

  @Get('/facebook')
  @Login(FB_AUTH)
  async fbLogin() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/facebook/callback')
  @Login(FB_AUTH)
  async fbLoginComplete() {
    return new Redirect('/auth/self', 301);
  }

  @Post('/logout')
  @Logout()
  async logout() { }

  /**
   * Simple Echo
   */
  @Post('/')
  async echo(req: Request): Promise<object> {
    return req.body;
  }
}