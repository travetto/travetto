import { Suite } from '@travetto/test';
import { ExpressWebServer } from '@travetto/web-express';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { ModelBlobWebUploadServerSuite } from './server.ts';

const EXPRESS = Symbol.for('express');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new ExpressWebServer();
  }

  @InjectableFactory(EXPRESS)
  static getApp(dep: ExpressWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class ExpressWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = EXPRESS;
}
