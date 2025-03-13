import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-file';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheSymbols.Model)
  static getModel(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileCacheSuite extends CacheServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}