import { Suite } from '@travetto/test';
import { NodeWebServer } from '@travetto/web-node';
import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';
import { NodeWebServerSupport } from '@travetto/web-node/support/test/server-support.ts';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class NodeWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = ServerSymbol;
  type = NodeWebServerSupport;
}
