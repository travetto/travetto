import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}