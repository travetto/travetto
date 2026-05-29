import { Inject } from '@travetto/di';
import { Controller, Get } from '@travetto/web';

import { HomeService } from '../service/home.ts';

@Controller('/home')
export class HomeController {
  @Inject()
  service: HomeService;

  @Get('/')
  getHome(): { status: string; message: string } {
    return { status: 'ok', message: this.service.getMessage() };
  }
}
