import { Suite } from '@travetto/test';
import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';

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