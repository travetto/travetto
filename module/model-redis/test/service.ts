import { Suite } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelExpirySuite } from '@travetto/model-core/test/lib/expiry';

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