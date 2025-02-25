import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';

import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';

class Init {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(config: RedisModelConfig) {
    return new RedisModelService(config);
  }
}

@Suite()
export class RedisAuthModelServiceSuite extends AuthModelServiceSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}
