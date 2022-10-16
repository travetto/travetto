import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model';
import { Suite } from '@travetto/test';

import { CacheModelⲐ } from '../../src/service';
import { CacheServiceSuite } from '../../support/test.service';

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