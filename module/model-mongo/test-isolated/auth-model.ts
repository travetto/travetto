// @file-if @travetto/auth
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth/test-support/model';

import { MongoModelConfig, MongoModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: MongoModelConfig) {
    return new MongoModelService(config);
  }
}

@Suite()
export class MongoAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}