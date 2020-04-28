import { RestApp, Application, Controller, Get, Context } from '@travetto/rest';
import { Inject, InjectableFactory } from '@travetto/di';
import { ModelCacheStore, CacheStore } from '@travetto/cache';
import { ModelService } from '@travetto/model';

import { SessionData, Session } from '../../src/types';
import { SESSION_CACHE } from '../../src/service';

@Application('e2e')
export class App {

  @InjectableFactory(SESSION_CACHE)
  static getSessionStore(service: ModelService): CacheStore {
    return new ModelCacheStore(service);
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