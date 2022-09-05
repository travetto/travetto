// @with-module @travetto/auth-model
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcⲐ } from '@travetto/auth-model/test-support/model';

import { RedisModelConfig, RedisModelService } from '..';

class Init {
  @InjectableFactory(TestModelSvcⲐ)
  static modelProvider(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}