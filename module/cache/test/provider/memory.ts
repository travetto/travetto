import { InjectableFactory } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '../../src/service';
import { CacheTestSuite } from '../cache';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: MemoryModelConfig) {
    return new MemoryModelService(config);
  }
}

@Suite()
export class MemoryCacheSuite extends CacheTestSuite {
  baseLatency = 100;
  constructor() {
    super(MemoryModelService, MemoryModelConfig);
  }
}