import { Inject } from '@travetto/di';
import { Controller, Get, ControllerRegistry, Redirect } from '@travetto/express';

import { Authenticate, Authenticated } from '../../support/extension.express';
import { FB_AUTH } from './conf';
import { AuthService } from '../../src';

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