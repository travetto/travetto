import { Suite } from '@travetto/test';
import { ExpressWebServer } from '@travetto/web-express';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server.ts';

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
}

@Suite()
export class ExpressAuthWebTest extends AuthWebServerSuite {
  qualifier = ServerSymbol;
}
