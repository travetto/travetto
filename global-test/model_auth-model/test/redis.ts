import { InjectableFactory } from '@travetto/di';
import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
class RedisAuthModelServiceSuite extends AuthModelServiceSuite<RedisModelService> {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
