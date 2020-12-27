import { GetOption, SetOption } from 'cookies';

import { Controller } from '../../../src/decorator/controller';
import { Get } from '../../../src/decorator/endpoint';
import { Request, Response } from '../../../src/types';
import { Query } from '../../../src/decorator/param';

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