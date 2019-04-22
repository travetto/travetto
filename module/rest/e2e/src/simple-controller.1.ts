import { WithAsyncContext, Context } from '@travetto/context';

import { Controller, Get } from '../..';
import { MockService } from './mock';

@Controller('/simple2')
export class Simple {

  constructor(private service: MockService, public context: AsyncContext) {
  }

  @Get('/name')
  async doIt() {
    return 'bobs';
  }

  @Get('/age')
  async age() {
    console.log(53);
  }

  @Get('/age2')
  @WithAsyncContext()
  async age2() {
    if (Math.random() > .66) {
      this.context.get().name = `Roger-${Date.now()}`;
    }
    return this.service.fetch().middle!.toUpperCase();
  }

  @Get('/age3')
  async age3() {
    return 'hi';
  }
}
