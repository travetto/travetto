import { Suite } from '@travetto/test';
import { ExpressRestServer } from '@travetto/rest-express';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';

import { AuthRestServerSuite } from '@travetto/auth-rest/support/test/server';

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

@Suite()
export class ExpressAuthRestTest extends AuthRestServerSuite {
  qualifier = EXPRESS;
}
