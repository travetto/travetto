// @with-module @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelⲐ } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/support/service';

import { S3ModelService, S3ModelConfig } from '..';

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