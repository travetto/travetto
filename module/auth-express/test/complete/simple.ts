import { Inject } from '@travetto/di';
import { Controller, Get, Redirect } from '@travetto/express';
import { AuthService } from '@travetto/auth';

import { Authenticate, Authenticated } from '../../src';
import { FB_AUTH } from './conf';

@Controller('/auth')
export class SampleAuth {

  @Inject()
  private service: AuthService;

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin() {

  }

  @Get('/self')
  @Authenticated()
  async getSelf() {
    return this.service.context;
  }

  @Get('/facebook/callback')
  @Authenticate(FB_AUTH)
  async fbLoginComplete() {
    return new Redirect('/auth/self', 301);
  }
}