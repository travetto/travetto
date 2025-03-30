import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server.ts';

const NODE = Symbol.for('node');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new NodeWebServer();
  }

  @InjectableFactory(NODE)
  static getApp(dep: NodeWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class NodeWebUploadTest extends WebUploadServerSuite {
  qualifier = NODE;
}
