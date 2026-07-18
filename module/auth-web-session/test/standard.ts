import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { Suite } from '@travetto/test';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';
import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
class StandardAuthWebSessionTest extends AuthWebSessionServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
