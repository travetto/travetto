import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { InjectableFactory } from '@travetto/di';
import { WebApplication } from '@travetto/web';

import { NodeWebServerSupport } from '@travetto/web-node/support/test/server-support.ts';

import { ModelBlobWebUploadServerSuite } from './server.ts';

const ServerSymbol = Symbol.for('node');

class Config {
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
  type = NodeWebServerSupport;
}
