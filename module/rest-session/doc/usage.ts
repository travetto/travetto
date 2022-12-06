import { Controller, Put, Get } from '@travetto/rest';
import { SessionData, Session } from '@travetto/rest-session';

@Controller('/session')
export class SessionRoutes {

  @Put('/info')
  async storeInfo(data: SessionData) {
    data.age = 20;
    data.name = 'Roger'; // Setting data
  }

  @Get('/logout')
  async logout(session: Session) {
    await session.destroy();
  }

  @Get('/info/age')
  async getInfo(data: SessionData) {
    return data.age;
  }
}