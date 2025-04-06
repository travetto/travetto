import { Suite } from '@travetto/test';
import { WebInternalSymbol } from '@travetto/web';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/auth-session';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { BasicWebServerSupport } from '@travetto/web/support/test/server-support.ts';


import { AuthWebSessionServerSuite } from '../support/test/server.ts';


class Config {
  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}


@Suite()
export class StandardAuthWebSessionTest extends AuthWebSessionServerSuite {
  type = BasicWebServerSupport;
  qualifier = WebInternalSymbol;
}
