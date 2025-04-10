import { Suite } from '@travetto/test';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/auth-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { StandardWebRouter } from '@travetto/web';

import { AuthWebSessionServerSuite } from '../support/test/server.ts';

class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class StandardAuthWebSessionTest extends AuthWebSessionServerSuite {
  dispatcherType = StandardWebRouter;
}
