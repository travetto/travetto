import { RestApp, Application, Controller, Get, Request } from '@travetto/rest';
import { Inject, InjectableFactory } from '@travetto/di';
import { ModelStore } from '../../extension/model.store';
import { SessionStore } from '../../src/store/store';

@Application('main man')
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
  async login(req: Request) {
    if (!req.session.age) {
      req.session = { age: 10 };
    } else {
      req.session.age *= 10;
    }
    return req.session;
  }

  @Get('/logout')
  async logout(req: Request) {
    req.session = undefined;
    return {};
  }
}