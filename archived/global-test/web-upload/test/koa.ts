import { Suite } from '@travetto/test';
import { KoaWebServer } from '@travetto/web-koa';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server.ts';

const ServerSymbol = Symbol.for('koa');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new KoaWebServer();
  }

  @InjectableFactory(ServerSymbol)
  static getApp(dep: KoaWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class KoaWebUploadTest extends WebUploadServerSuite {
  qualifier = ServerSymbol;
}
