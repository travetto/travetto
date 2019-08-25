import { RestApp, Application, Controller, Get, Context } from '@travetto/rest';
import { Inject, InjectableFactory } from '@travetto/di';
import { CacheStore } from '@travetto/cache';
import { ModelCacheStore } from '@travetto/cache/extension/model.store';

import { SessionData, Session } from '../../src/types';
import { SESSION_CACHE } from '../../src/service';

@Application('e2e')
export class App {

  @InjectableFactory(SESSION_CACHE)
  static getSessionStore(): CacheStore {
    return new ModelCacheStore();
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