import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/auth-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';

import { AuthWebSessionServerSuite } from '../support/test/server.ts';

class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class StandardAuthWebSessionTest extends AuthWebSessionServerSuite {
  dispatcherType = LocalRequestDispatcher;
}
