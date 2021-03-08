import { InjectableFactory } from '@travetto/di';
import { FileModelConfig, FileModelService } from '@travetto/model';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '../../src/service';
import { CacheServiceSuite } from '../../test-support/service';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: FileModelConfig) {
    return new FileModelService(config);
  }
}

@Suite()
export class FileCacheSuite extends CacheServiceSuite {
  serviceClass = FileModelService;
  configClass = FileModelConfig;
}