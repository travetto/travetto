import { Controller, Get } from '..';
import { MockService } from './mock';

@Controller('/weird')
export class Weird {

  #service: MockService;

  constructor(service: MockService) {
    this.#service = service;
  }

  @Get('/name')
  async doIt() {
    return 'bobs-dvd';
  }

  @Get('/age')
  async age() {
    console.log('age', { value: 55 });
  }

  @Get('/age2')
  async age2() {
    return `${this.#service.fetch().middle!.toUpperCase()}s`;
  }

  @Get('/age3')
  async age3() {
    return 'his';
  }
}
