// @file-if @travetto/asset

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AssetModelSym } from '@travetto/asset';
import { AssetServiceSuite } from '@travetto/asset/test-support/service';

import { MongoModelConfig, MongoModelService } from '..';

class Init {
  @InjectableFactory(AssetModelSym)
  static modelProvider(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoAssetServiceSuite extends AssetServiceSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}