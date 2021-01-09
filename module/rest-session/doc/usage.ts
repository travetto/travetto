import { Controller, Put, Get, Context } from '@travetto/rest';
import { SessionData, Session } from '@travetto/rest-session';

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