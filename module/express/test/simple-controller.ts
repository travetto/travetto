import { Controller, Get } from '../src';
import { MockService } from './mock';
import { Injectable, DependencyRegistry } from '@encore2/di';

// const papaparse = require('papaparse');
// import * as papaparse from 'papaparse';

@Controller('/simple')
export class Simple {

  constructor(private service: MockService) {
  }

  @Get('/nameAngry')
  async doItAngry() {
    let user = await this.service.fetch();
    return user.first.toUpperCase();
  }

  @Get('/names')
  async doIt() {
    let user = await this.service.fetch();
    return user.first;
  }

  @Get('/name2')
  async doIt2() {
    let user = await this.service.fetch2();
    return user.last;
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