import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '../../src/service';
import { CacheServiceSuite } from '../../test-support/service';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryCacheSuite extends CacheServiceSuite {
  baseLatency = 100;
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}