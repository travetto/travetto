// @file-if @travetto/model
import { Application } from '@travetto/app';
import { RestApplication, Controller, Get } from '@travetto/rest';
import { Inject, InjectableFactory } from '@travetto/di';
import { CacheService } from '@travetto/cache';
import { ModelExpirySupport } from '@travetto/model';

import { SessionData, Session } from '..';

@Application('e2e')
export class App {

  @InjectableFactory()
  static getSessionSource(service: ModelExpirySupport): CacheService {
    return new CacheService(service);
  }

  @Inject()
  server: RestApplication;

  run() {
    return this.server.run();
  }
}

@Controller('/auth')
class Test {
  @Get('/login')
  async login(data: SessionData) {
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