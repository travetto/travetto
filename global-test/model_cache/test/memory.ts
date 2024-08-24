import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { Suite } from '@travetto/test';

import { CacheModelⲐ } from '@travetto/cache/src/service';
import { CacheServiceSuite } from '@travetto/cache/support/test/service';

class Config {
  @InjectableFactory(CacheModelⲐ)
  static getModel(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryCacheSuite extends CacheServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}