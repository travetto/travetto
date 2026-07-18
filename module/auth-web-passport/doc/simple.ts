import type { Principal } from '@travetto/auth';
import { Authenticated, Login, Logout } from '@travetto/auth-web';
import { ContextParam, Controller, Get, Post, type WebRequest, WebResponse } from '@travetto/web';

import { FbAuthSymbol } from './config.ts';

@Controller('/auth')
export class SampleAuth {
  @ContextParam()
  request: WebRequest;

  @ContextParam()
  user: Principal;

  @Get('/name')
  async getName() {
    return { name: 'bob' };
  }

  @Get('/facebook')
  @Login(FbAuthSymbol)
  async fbLogin() {}

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.user;
  }

  @Get('/facebook/callback')
  @Login(FbAuthSymbol)
  async fbLoginComplete() {
    return WebResponse.redirect('/auth/self');
  }

  @Post('/logout')
  @Logout()
  async logout() {}

  /**
   * Simple Echo
   */
  @Post('/')
  async echo(): Promise<unknown> {
    return this.request.body;
  }
}
