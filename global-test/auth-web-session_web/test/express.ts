import { Suite } from '@travetto/test';
import { ExpressWebServer } from '@travetto/web-express';
import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';

const ServerSymbol = Symbol.for('express');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new ExpressWebServer();
  }

  @InjectableFactory(ServerSymbol)
  static getApp(dep: ExpressWebServer): WebApplication {
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
export class ExpressWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = ServerSymbol;
}
