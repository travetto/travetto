import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSym } from '../../test-support/service';

class Init {
  @InjectableFactory(TestModelSvcSym)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}