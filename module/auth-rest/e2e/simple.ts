import { Inject } from '@travetto/di';
import { Controller, Get, Redirect, Post } from '@travetto/rest';
import { AuthService } from '@travetto/auth';

import { Authenticate, Authenticated, Unauthenticated } from '../src';
import { FB_AUTH } from './conf';
import { Request, Response } from 'express';

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

  @Post('/logout')
  @Unauthenticated()
  async logout(req: Request, res: Response) {
    await req.auth.logout();
  }
}