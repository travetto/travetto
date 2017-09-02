import { Controller, Get } from '../src';


@Controller('/simple')
export class Simple {

  @Get('/name')
  async doIt() {
    console.log('Go its!');
    return {
      first: 'A',
      last: 'B'
    };
  }
}
