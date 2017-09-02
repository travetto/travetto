import { Controller, Get } from '../src';


@Controller('/simple')
export class Simple {

  @Get('/name')
  async doIt() {
    console.log('');
    return {
      first: 'A',
      last: 'B'
    };
  }

  @Get('/age')
  async age() {
    console.log(20);
  }
}
