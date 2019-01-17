import { Controller, Get, Cache, Request, Response, Post } from '@travetto/rest';

import { MockService } from './mock';

@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt(req: Request, res: Response): Promise<{ name: string }> {
    const user = await this.service.fetch();
    return { name: `/simple/name => ${user.first.toLowerCase()}` };
  }

  @Cache(1, 'd')
  @Get('/nameAngry')
  async doItAngry() {
    const user = await this.service.fetch();
    return user.first.toUpperCase();
  }

  @Post('/name2')
  async doIt2(req: Request) {
    return req.body;
  }

  @Get('/ages')
  async ages() {
    return 'woah';
    //    throw new Error('aah');
  }

  @Get('/age2')
  async age2() {
    return (this.service.fetch().middle! as any).toUpperCase();
  }

  @Get('/age3')
  async age3() {
    return 'hi';
  }
}