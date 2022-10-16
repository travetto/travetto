// @with-module @travetto/asset

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AssetModelⲐ } from '@travetto/asset';
import { AssetServiceSuite } from '@travetto/asset/support/test.service';

import { S3ModelConfig, S3ModelService } from '..';

class Init {
  @InjectableFactory(AssetModelⲐ)
  static modelProvider(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
export class S3AssetServiceSuite extends AssetServiceSuite {
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}