// @file-if @travetto/cache

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { CacheModelSym } from '@travetto/cache';
import { CacheServiceSuite } from '@travetto/cache/test-support/service';

import { S3ModelService, S3ModelConfig } from '..';

class Config {
  @InjectableFactory(CacheModelSym)
  static getModel(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
export class S3CacheSuite extends CacheServiceSuite {
  baseLatency = 150;

  constructor() {
    super(S3ModelService, S3ModelConfig);
  }
}