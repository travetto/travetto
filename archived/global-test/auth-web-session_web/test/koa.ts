import { Suite } from '@travetto/test';
import { KoaWebServer } from '@travetto/web-koa';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelSymbol } from '@travetto/auth-session';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class KoaWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = ServerSymbol;
}
