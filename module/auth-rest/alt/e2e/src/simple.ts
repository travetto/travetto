import { Controller, Get, Redirect, Request } from '@travetto/rest';

import { Authenticate, Authenticated } from '../../..';
import { SIMPLE_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

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
    return req.auth?.principal;
  }

  @Get('/logout')
  @Authenticated()
  async logout(req: Request) {
    await req.logout();
    return new Redirect('/auth/self', 301);
  }
}