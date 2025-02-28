import { GetOption, SetOption } from 'cookies';

import { Controller, Get, QueryParam, HttpRequest, HttpResponse } from '@travetto/rest';

@Controller('/simple')
export class SimpleRoutes {

  private getOptions: GetOption;
  private setOptions: SetOption;

  @Get('/cookies')
  cookies(req: HttpRequest, res: HttpResponse, @QueryParam() value: string) {
    req.cookies.get('name', this.getOptions);
    res.cookies.set('name', value, this.setOptions);
  }
}