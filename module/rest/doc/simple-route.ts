import { Get, Controller } from '@travetto/rest';

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