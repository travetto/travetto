import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@encore2/di';


@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/names')
  async doIt() {
    return this.service.fetch();
  }

  @Get('/age')
  async age() {
    return Math.random() + 'bob';
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
