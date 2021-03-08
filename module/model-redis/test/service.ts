import { Suite } from '@travetto/test';
import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelExpirySuite } from '@travetto/model/test-support/expiry';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

import { RedisModelConfig, RedisModelService } from '..';

@Suite()
export class RedisBasicSuite extends ModelBasicSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
export class RedisCrudSuite extends ModelCrudSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
export class RedisExpirySuite extends ModelExpirySuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
export class RedisIndexedSuite extends ModelIndexedSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}

@Suite()
export class RedisPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = RedisModelService;
  configClass = RedisModelConfig;
}