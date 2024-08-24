import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model-file';
import { Suite } from '@travetto/test';

import { CacheModelⲐ } from '@travetto/cache/src/service';
import { CacheServiceSuite } from '@travetto/cache/support/test/service';

class Config {
  @InjectableFactory(CacheModelⲐ)
  static getModel(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileCacheSuite extends CacheServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}