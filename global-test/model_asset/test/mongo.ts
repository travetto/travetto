
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AssetModelⲐ } from '@travetto/asset';
import { AssetServiceSuite } from '@travetto/asset/support/test/service';

import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';

class Init {
  @InjectableFactory(AssetModelⲐ)
  static modelProvider(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoAssetServiceSuite extends AssetServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
