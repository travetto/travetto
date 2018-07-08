import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@travetto/di';
import { WithContext, Context } from '@travetto/context';

@Controller('/simple2')
export class Simple {

  constructor(private service: MockService, public context: Context) {
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
  @WithContext()
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
