import { Controller, Get } from '../src';
import { MockService } from './mock';

@Controller('/weird')
export class Weird {

  constructor(private service: MockService) {
  }

  @Get('/name')
  async doIt() {
    return 'bobs-kdvd';
  }

  @Get('/age')
  async age() {
    console.log(55);
  }

  @Get('/age2')
  async age2() {
    return `${this.service.fetch().middle!.toUpperCase()}s`;
  }

  @Get('/age3')
  async age3() {
    return 'his';
  }
}
