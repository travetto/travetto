import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelExpirySuite } from '@travetto/model/test-support/expiry';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';

import { RedisModelConfig, RedisModelService } from '..';

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