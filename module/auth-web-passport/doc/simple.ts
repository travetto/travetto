import { Controller, Get, Redirect, Post, HttpRequest } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { AsyncContextField } from '@travetto/context';

import { FB_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

  @AsyncContextField()
  readonly req: HttpRequest;

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
  async getSelf() {
    return this.req.user;
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
  async echo(): Promise<object> {
    return this.req.body;
  }
}