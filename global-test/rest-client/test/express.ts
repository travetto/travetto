import { RestClientServerSuite } from '@travetto/rest-client/support/test/server.ts';
import { Suite } from '@travetto/test';
import { ExpressRestServer } from '@travetto/rest-express';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';

const EXPRESS = Symbol.for('express');

class Config {
  @InjectableFactory()
  static getServer(): RestServer {
    return new ExpressRestServer();
  }

  @InjectableFactory(EXPRESS)
  static getApp(dep: ExpressRestServer): RestApplication {
    return new class extends RestApplication {
      server = dep;
    }();
  }
}

@Suite({ tags: ['expensive'] })
export class ExpressRestClientTest extends RestClientServerSuite {
  qualifier = EXPRESS;
}
