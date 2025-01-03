import { InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { Controller, Put, Get } from '@travetto/rest';
import { SessionData, Session, SessionModelSymbol } from '@travetto/rest-session';
import { MemoryModelService } from '@travetto/model-memory';

// Applies to entire execution, not just this file
class SessionConfig {
  /**
   * Session provider must be specified. The memory service is sufficient for simple
   *   workloads, buts falls down when dealing with multiple servers
   */
  @InjectableFactory(SessionModelSymbol)
  static getSessionModel(memory: MemoryModelService): ModelExpirySupport {
    return memory;
  }
}

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