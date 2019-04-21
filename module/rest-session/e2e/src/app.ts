import { RestApp, Application, Controller, Get, Context } from '@travetto/rest';
import { Inject, InjectableFactory } from '@travetto/di';
import { ModelStore } from '../../extension/model.store';
import { SessionStore } from '../../src/store/store';
import { SessionData, Session } from '../../src/types';

@Application('e2e')
export class App {
  @InjectableFactory()
  static getSessionStore(): SessionStore {
    return new ModelStore();
  }

  @Inject()
  app: RestApp;

  run() {
    return this.app.run();
  }
}

@Controller('/auth')
class Test {
  @Get('/login')
  async login(@Context() data: SessionData) {
    if (!data.age) {
      data.age = 10;
    } else {
      data.age *= 10;
    }
    return data;
  }

  @Get('/logout')
  async logout(session: Session) {
    session.destroy();
    return {};
  }
}