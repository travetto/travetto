import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
class MemoryAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}