import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { ModelBlobWebUploadServerSuite } from './server.ts';

const ServerSymbol = Symbol.for('node');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new NodeWebServer();
  }

  @InjectableFactory(ServerSymbol)
  static getApp(dep: NodeWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class NodeWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = ServerSymbol;
}
