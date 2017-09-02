import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable } from '@encore/di';


@Controller('/simple')
export class Simple {

  constructor(private service: MockService) { }

  @Get('/name')
  async doIt() {
    console.log(this.service);
    return this.service.fetch();
  }

  @Get('/age')
  async age() {
    console.log(55);
  }
}
