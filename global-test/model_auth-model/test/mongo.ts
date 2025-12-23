import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
class MongoAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
