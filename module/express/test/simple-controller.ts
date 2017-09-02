import { Controller, Get } from '../src';


@Controller('/simple')
export class Simple {

  @Get('/name')
  async doIt() {
    return {
      first: 'A',
      last: 'B'
    }
  }
}