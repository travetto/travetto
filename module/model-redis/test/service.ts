import { Suite } from '@travetto/test';
import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

@Suite()
class RedisBasicSuite extends ModelBasicSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
class RedisCrudSuite extends ModelCrudSuite {
  indexLimitSkew = 10;
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
class RedisExpirySuite extends ModelExpirySuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
class RedisPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}