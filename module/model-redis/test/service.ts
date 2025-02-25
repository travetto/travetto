import { Suite } from '@travetto/test';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

import { RedisModelConfig } from '../src/config.ts';
import { RedisModelService } from '../src/service.ts';

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