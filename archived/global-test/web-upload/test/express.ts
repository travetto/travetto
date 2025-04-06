import { Suite } from '@travetto/test';
import { ExpressWebServer } from '@travetto/web-express';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server.ts';

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
export class ExpressWebUploadTest extends WebUploadServerSuite {
  qualifier = ServerSymbol;
}
