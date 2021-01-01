import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { AuthModelSym } from '../../src/principal';
import { AuthModelServiceSuite } from '../../test-support/service';

class Init {
  @InjectableFactory(AuthModelSym)
  static modelProvider(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryAuthModelServiceSuite extends AuthModelServiceSuite {
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}