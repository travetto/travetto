import { Suite } from '@travetto/test';
import { KoaWebServer } from '@travetto/web-koa';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { ModelBlobWebUploadServerSuite } from './server.ts';

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
export class KoaWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = KOA;
}
