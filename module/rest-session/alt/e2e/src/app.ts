// @file-if @travetto/model
import { Application } from '@travetto/app';
import { RestServer, Controller, Get, Context } from '@travetto/rest';
import { Inject, InjectableFactory } from '@travetto/di';
import { ModelCacheSource, CacheSource } from '@travetto/cache';
import { ModelService } from '@travetto/model';

import { SessionCacheSymbol, SessionData, Session } from '../../..';

@Application('e2e')
export class App {

  @InjectableFactory(SessionCacheSymbol)
  static getSessionSource(service: ModelService): CacheSource {
    return new ModelCacheSource(service);
  }

  @Inject()
  server: RestServer;

  run() {
    return this.server.run();
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