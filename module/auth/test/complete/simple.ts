import { Inject } from '@travetto/di';
import { Controller, Get, ControllerRegistry } from '@travetto/express';

import { Authenticate } from '../../support/extension.express';
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

  @Get('/facebook/callback')
  @Authenticate(FB_AUTH)
  async fbLoginComplete() {
    return this.service.context;
  }
}