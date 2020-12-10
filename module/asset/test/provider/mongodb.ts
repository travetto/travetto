// @file-if mongodb

import { InjectableFactory } from '@travetto/di';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { Suite } from '@travetto/test';
import { AssetModelSymbol } from '../../src/service';
import { AssetServiceSuite } from '../service';

class Init {
  @InjectableFactory(AssetModelSymbol)
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