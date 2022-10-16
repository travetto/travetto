import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcⲐ } from '../support/test.model';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}