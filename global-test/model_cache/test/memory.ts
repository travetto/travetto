import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheSymbols.Model)
  static getModel(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryCacheSuite extends CacheServiceSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}