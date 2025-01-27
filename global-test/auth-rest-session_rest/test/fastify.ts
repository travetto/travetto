import { AuthRestSessionServerSuite } from '@travetto/auth-rest-session/support/test/server';
import { Suite } from '@travetto/test';
import { FastifyRestServer } from '@travetto/rest-fastify';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelSymbol } from '@travetto/auth-session';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class FastifyRestSessionTest extends AuthRestSessionServerSuite {
  qualifier = FASTIFY;
}
