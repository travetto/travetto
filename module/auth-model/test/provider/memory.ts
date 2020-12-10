import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { AuthModelSymbol } from '../../src/principal';
import { AuthModelServiceSuite } from '../lib/service';

class Init {
  @InjectableFactory(AuthModelSymbol)
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