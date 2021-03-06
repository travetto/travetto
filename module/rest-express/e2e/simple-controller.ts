import { Controller, Post, Get, CacheControl, Body } from '@travetto/rest';
import { MockService } from './mock';

@Controller('/simple')
export class Simple {

  #service: MockService;

  constructor(service: MockService) {
    this.#service = service;
  }

  @Get('/name/:age')
  async doIt(age: number, page: number = 5): Promise<string> {
    const user = await this.#service.fetch();
    return `/simple/names => ${user.first.toLowerCase()} ${age + page}`;
  }

  @CacheControl(1, 'd')
  @Get('/nameAngry')
  async doItAngry() {
    const user = await this.#service.fetch();
    return user.first.toUpperCase();
  }

  @Get('/name2')
  async doIt2() {
    const user = await this.#service.fetch2();
    return user.last;
  }

  @Get('/ages')
  async ages() {
    return 'woah';
    //    throw new Error('aah');
  }

  @Get('/age2')
  async age2() {
    return this.#service.fetch().middle!.toUpperCase();
  }

  @Get('/age3')
  async age3() {
    return 'hi';
  }

  @Post('/age4')
  async age4(@Body() obj: Record<string, string>) {
    console.log('Request', obj);
  }

  @Get('/map')
  async map() {
    return new Map([['key', 'value']]);
  }

  @Get('/set')
  async set() {
    return new Set(['key', 'value']);
  }

  @Get('/obj')
  async obj() {
    return { key: 'value' };
  }

  @Get('/arr')
  async arr() {
    return ['a', 'b'];
  }
}