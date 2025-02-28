import { Inject, InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { Controller, Put, Get } from '@travetto/web';
import { SessionData, SessionModelSymbol, SessionService } from '@travetto/auth-session';
import { MemoryModelService } from '@travetto/model-memory';
import { Authenticated } from '@travetto/auth-web';

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

@Authenticated()
@Controller('/session')
export class SessionRoutes {

  @Inject()
  service: SessionService;

  @Put('/info')
  async storeInfo(data?: SessionData) {
    if (data) {
      data.age = 20;
      data.name = 'Roger'; // Setting data
    }
  }

  @Get('/logout')
  async logout() {
    await this.service.destroy();
  }

  @Get('/info/age')
  async getInfo() {
    const { data } = this.service.getOrCreate();
    return data?.age;
  }
}