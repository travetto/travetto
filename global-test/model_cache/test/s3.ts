
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheSymbols } from '@travetto/cache';
import { S3ModelService, S3ModelConfig } from '@travetto/model-s3';

import { CacheServiceSuite } from '@travetto/cache/support/test/service';

class Config {
  @InjectableFactory(CacheSymbols.Model)
  static getModel(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
export class S3CacheSuite extends CacheServiceSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
  baseLatency = 150;
}
