import assert from 'node:assert';

import { DependencyRegistryIndex } from '@travetto/di';
import { RedisModelConfig, RedisModelService } from '@travetto/model-redis';
import { Util } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { CustomIdModel, ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
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

  @Test('Verify update creates when readBeforeUpdate is false')
  async testUpdateWithoutReadBeforeUpdate() {
    const service = await this.service;
    const config = await DependencyRegistryIndex.getInstance(this.configClass);
    assert(config.readBeforeUpdate === true);
    assert(new this.configClass().readBeforeUpdate === false);
    try {
      config.readBeforeUpdate = false;
      const nonExistentId = Util.uuid(32);
      const result = await service.update(CustomIdModel, CustomIdModel.from({ customId: nonExistentId, name: 'bob' }));
      assert(result.customId === nonExistentId);
      const fetched = await service.get(CustomIdModel, nonExistentId);
      assert(fetched.name === 'bob');
    } finally {
      config.readBeforeUpdate = true;
    }
  }
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
