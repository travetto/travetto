import { Get, Controller } from '@travetto/web';

class Data { }

@Controller('/simple')
class SimpleController {

  /**
   * Gets the most basic of data
   */
  @Get('/')
  async simpleGet() {
    let data: Data | undefined;
    // Do work
    return data;
  }
}