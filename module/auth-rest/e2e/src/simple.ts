import { Inject } from '@travetto/di';
import { Controller, Get, Redirect, Request } from '@travetto/rest';

import { AuthService, Authenticate, Authenticated } from '../..';
import { SIMPLE_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

  @Inject()
  auth: AuthService;

  @Get('/name')
  async getName() {
    return { name: 'bobs' };
  }

  @Get('/simple')
  @Authenticate(SIMPLE_AUTH)
  async simpleLogin() {
    return new Redirect('/auth/self', 301);
  }

  @Get('/self')
  @Authenticated()
  async getSelf(req: Request) {
    return req.auth!;
  }

  @Get('/logout')
  @Authenticated()
  async logout(req: Request) {
    await this.auth.logout(req);
    return new Redirect('/auth/self', 301);
  }
}