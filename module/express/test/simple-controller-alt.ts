import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@encore/di';


@Controller('/simple-alt')
export class Simple2 {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt() {
    return this.service.fetch().first;
  }

  @Get('/age')
  async age() {
    return 20;
  }

  @Get('/age2')
  async age2() {
    return 22;
  }
}
