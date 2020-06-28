import { Controller } from '../../../src/decorator/controller';
import { Get } from '../../../src/decorator/endpoint';

class Data { }

@Controller('/simple')
class SimpleController {

  /**
   * Gets the most basic of data
   */
  @Get('/')
  async simpleGet() {
    let data: Data | undefined;
    //
    return data;
  }
}