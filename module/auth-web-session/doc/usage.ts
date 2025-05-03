import { Inject, InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { Controller, Put, Get, ContextParam } from '@travetto/web';
import { SessionContext, SessionData, SessionModelSymbol } from '@travetto/auth-session';
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
export class SessionEndpoints {

  @Inject()
  session: SessionContext;

  @ContextParam()
  data: SessionData;

  @Put('/info')
  async storeInfo() {
    if (this.data) {
      this.data.age = 20;
      this.data.name = 'Roger'; // Setting data
    }
  }

  @Get('/logout')
  async logout() {
    await this.session.destroy();
  }

  @Get('/info/age')
  async getInfo() {
    const { data } = this.session.get(true);
    return data?.age;
  }
}