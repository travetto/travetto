import { Suite } from '@travetto/test';
import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelExpirySuite } from '@travetto/model/test-support/expiry';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';
import { ModelPolymorphismSuite } from '@travetto/model/test-support/polymorphism';

import { RedisModelConfig, RedisModelService } from '..';

@Suite()
export class RedisBasicSuite extends ModelBasicSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}

@Suite()
export class RedisCrudSuite extends ModelCrudSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}

@Suite()
export class RedisExpirySuite extends ModelExpirySuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}

@Suite()
export class RedisIndexedSuite extends ModelIndexedSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}

@Suite()
export class RedisPolymorphismSuite extends ModelPolymorphismSuite {
  constructor() {
    super(RedisModelService, RedisModelConfig);
  }
}