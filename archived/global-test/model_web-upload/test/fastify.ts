import { Suite } from '@travetto/test';
import { FastifyWebServer } from '@travetto/web-fastify';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { ModelBlobWebUploadServerSuite } from '../../../../global-test/model_web-upload/test/server.ts';

const ServerSymbol = Symbol.for('fastify');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new FastifyWebServer();
  }

  @InjectableFactory(ServerSymbol)
  static getApp(dep: FastifyWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class FastifyWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = ServerSymbol;
}
