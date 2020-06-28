import { Controller } from '@travetto/rest/src/decorator/controller';
import { Put, Get } from '@travetto/rest/src/decorator/endpoint';
import { Context } from '@travetto/rest/src/decorator/param';
import { SessionData, Session } from '../../src/types';

@Controller('/session')
export class SessionRoutes {

  @Put('/info')
  async storeInfo(@Context() data: SessionData) {
    data.age = 20;
    data.name = 'Roger'; // Setting data
  }

  @Get('/logout')
  async logout(@Context() session: Session) {
    await session.destroy();
  }

  @Get('/info/age')
  async getInfo(@Context() data: SessionData) {
    return data.age;
  }
}