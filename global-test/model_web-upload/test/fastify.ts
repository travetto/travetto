import { Suite } from '@travetto/test';
import { FastifyWebServer } from '@travetto/web-fastify';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { ModelBlobWebUploadServerSuite } from './server.ts';

const FASTIFY = Symbol.for('fastify');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new FastifyWebServer();
  }

  @InjectableFactory(FASTIFY)
  static getApp(dep: FastifyWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class FastifyWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = FASTIFY;
}
