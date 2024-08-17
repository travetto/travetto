import { RestSessionServerSuite } from '@travetto/rest-session/support/test/server';
import { Suite } from '@travetto/test';
import { ExpressRestServer } from '@travetto/rest-express';
import { SessionModelⲐ } from '@travetto/rest-session';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelⲐ })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class ExpressRestSessionTest extends RestSessionServerSuite {
  qualifier = EXPRESS;
}
