// @file-if @travetto/asset

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AssetModelSymbol } from '@travetto/asset';
import { AssetServiceSuite } from '@travetto/asset/test/lib/service';

import { S3ModelConfig, S3ModelService } from '..';

class Init {
  @InjectableFactory(AssetModelSymbol)
  static modelProvider(config: S3ModelConfig) {
    return new S3ModelService(config);
  }
}

@Suite()
export class S3AssetServiceSuite extends AssetServiceSuite {
  constructor() {
    super(S3ModelService, S3ModelConfig);
  }
}