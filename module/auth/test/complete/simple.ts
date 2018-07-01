import { Request, Response } from 'express';

import { Controller, Get } from '@travetto/express';
import { Authenticate } from '../../support/extension.express';
import { FB_AUTH } from './config';

@Controller('/auth')
export class SampleAuth {

  @Get('/facebook')
  @Authenticate(FB_AUTH)
  async fbLogin(req: Request) {

  }

  @Get('/facebook/callback')
  async fbLoginComplete(req: Request) {
    return req.auth.context!;
  }
}