import { Suite } from '@travetto/test';
import { KoaWebServer } from '@travetto/web-koa';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server';

const KOA = Symbol.for('koa');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new KoaWebServer();
  }

  @InjectableFactory(KOA)
  static getApp(dep: KoaWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class KoaAuthWebTest extends AuthWebServerSuite {
  qualifier = KOA;
}
