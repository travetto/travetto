import { Controller, Get, Post, WebRequest, ContextParam, WebResponse } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { FbAuthSymbol } from './conf.ts';

@Controller('/auth')
export class SampleAuth {

  @ContextParam()
  req: WebRequest;

  @ContextParam()
  user: Principal;

  @Get('/name')
  async getName() {
    return { name: 'bob' };
  }

  @Get('/facebook')
  @Login(FbAuthSymbol)
  async fbLogin() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.user;
  }

  @Get('/facebook/callback')
  @Login(FbAuthSymbol)
  async fbLoginComplete() {
    return WebResponse.redirect('/auth/self', 301);
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