import { GetOption, SetOption } from 'cookies';

import { Controller, Get, Query, Request, Response } from '@travetto/rest';

@Controller('/simple')
export class SimpleRoutes {

  private getOptions: GetOption;
  private setOptions: SetOption;

  @Get('/cookies')
  cookies(req: Request, res: Response, @Query() value: string) {
    req.cookies.get('name', this.getOptions);
    res.cookies.set('name', value, this.setOptions);
  }
}