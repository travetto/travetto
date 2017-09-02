import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@encore/di';


@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt() {
    return this.service.fetch();
  }

  @Get('/age')
  async age() {
    console.log(55);
  }
}
