import { AuthRestServerSuite } from '@travetto/auth-rest/support/test/server';
import { Suite } from '@travetto/test';
import { FastifyRestServer } from '@travetto/rest-fastify';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';

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
}

@Suite()
export class FastifyAuthRestTest extends AuthRestServerSuite {
  qualifier = FASTIFY;
}
