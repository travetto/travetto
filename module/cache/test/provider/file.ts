import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-core';
import { Suite } from '@travetto/test';
import { CacheModelSymbol } from '../../src/service';
import { CacheServiceSuite } from '../../test-lib/service';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileCacheSuite extends CacheServiceSuite {
  constructor() {
    super(FileModelService, FileModelConfig);
  }
}