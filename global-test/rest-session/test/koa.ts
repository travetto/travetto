import { RestSessionServerSuite } from '@travetto/rest-session/support/test/server';
import { Suite } from '@travetto/test';
import { KoaRestServer } from '@travetto/rest-koa';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelⲐ } from '@travetto/rest-session';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelⲐ })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class KoaRestSessionTest extends RestSessionServerSuite {
  qualifier = KOA;
}
