import { AuthRestServerSuite } from '@travetto/auth-rest/support/test/server.ts';
import { Suite } from '@travetto/test';
import { KoaRestServer } from '@travetto/rest-koa';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';

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
export class KoaAuthRestTest extends AuthRestServerSuite {
  qualifier = KOA;
}
