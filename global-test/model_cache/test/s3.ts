import { CacheModelSymbol } from '@travetto/cache';
import { InjectableFactory } from '@travetto/di';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';
import { Suite } from '@travetto/test';

import { CacheServiceSuite } from '@travetto/cache/support/test/service.ts';

class Config {
  @InjectableFactory(CacheModelSymbol)
  static getModel(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
class S3CacheSuite extends CacheServiceSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
  baseLatency = 150;
}
