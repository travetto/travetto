import { Suite } from '@travetto/test';
import { KoaRestServer } from '@travetto/rest-koa';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';

import { RestUploadServerSuite } from '@travetto/rest-upload/support/test/server.ts';

const KOA = Symbol.for('koa');

class Config {
  @InjectableFactory()
  static getServer(): RestServer {
    return new KoaRestServer();
  }

  @InjectableFactory(KOA)
  static getApp(dep: KoaRestServer): RestApplication {
    return new class extends RestApplication {
      server = dep;
    }();
  }
}

@Suite()
export class KoaRestUploadTest extends RestUploadServerSuite {
  qualifier = KOA;
}
