import { Controller, Get, Redirect, Post, HttpRequest, ContextParam } from '@travetto/web';
import { Login, Authenticated, Logout } from '@travetto/auth-web';
import { Principal } from '@travetto/auth';

import { FbAuthSymbol } from './conf.ts';

@Controller('/auth')
export class SampleAuth {

  @ContextParam()
  req: HttpRequest;

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