import { Controller, Get, Redirect, Post, Request } from '@travetto/rest';
import { AuthService, Authenticate, Authenticated, Unauthenticated } from '@travetto/auth-rest';
import { Inject } from '@travetto/di';

import { FB_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

  @Inject()
  auth: AuthService;

  @Get('/name')
  async getName() {
    return { name: 'bob' };
  }

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth;
  }

  @Get('/facebook/callback')
  @Authenticate(FB_AUTH)
  async fbLoginComplete() {
    return new Redirect('/auth/self', 301);
  }

  @Post('/logout')
  @Unauthenticated()
  async logout(req: Request) {
    await this.auth.logout(req);
  }

  /**
   * Simple Echo
   */
  @Post('/')
  async echo(req: Request): Promise<object> {
    return req.body;
  }
}