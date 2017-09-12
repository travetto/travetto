import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@encore2/di';


@Controller('/simple2')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt() {
    return 'bob';
  }

  @Get('/age')
  async age() {
    console.log(53);
  }

  @Get('/age2')
  async age2() {
    return this.service.fetch().middle!.toUpperCase();
  }

  @Get('/age3')
  async age3() {
    return 'hi';
  }
}
