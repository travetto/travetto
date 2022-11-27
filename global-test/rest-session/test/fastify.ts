import { RestSessionServerSuite } from '@travetto/rest-session/support/test/server';
import { Suite } from '@travetto/test';
import { FastifyRestServer } from '@travetto/rest-fastify';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { SessionModelⲐ } from '@travetto/rest-session';

const FASTIFY = Symbol.for('fastify');

class Config {
  @InjectableFactory()
  static getServer(): RestServer {
    return new FastifyRestServer();
  }

  @InjectableFactory(FASTIFY)
  static getApp(dep: FastifyRestServer): RestApplication {
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
export class FastifyRestSessionTest extends RestSessionServerSuite {
  qualifier = FASTIFY;
}
