
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/test.service';

import { S3ModelService, S3ModelConfig } from '@travetto/model-s3';

class Config {
  @InjectableFactory(CacheModelⲐ)
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
