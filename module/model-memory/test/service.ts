import assert from 'node:assert';

import { DependencyRegistryIndex } from '@travetto/di';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { TimeUtil, Util } from '@travetto/runtime';
import { SkipUnless, Suite, Test } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';
import { CustomIdModel, ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ExpiryUser, ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

const KB = 2 ** 20;

@Suite()
class MemoryBasicSuite extends ModelBasicSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
class MemoryCrudSuite extends ModelCrudSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;

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
class MemoryBlobSuite extends ModelBlobSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
class MemoryExpirySuite extends ModelExpirySuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;

  @Test()
  @SkipUnless(() => Boolean(global.gc))
  async ensureCulled() {
    const service = await this.service;

    let total: number;

    total = await this.getSize(ExpiryUser);
    assert(total === 0);

    const startMemory = process.memoryUsage().arrayBuffers;
    console.log('Start memory', startMemory / KB);

    // Create
    await service.upsert(
      ExpiryUser,
      ExpiryUser.from({
        expiresAt: TimeUtil.fromNow('500ms'),
        payload: 'abcdefghij'.repeat(5 * KB) // 50mb
      })
    );

    const sizedMemory = process.memoryUsage().arrayBuffers;
    console.log('Sized memory', sizedMemory / KB);

    assert((sizedMemory - startMemory) * 1.05 >= 50 * KB); // Increased by 50mb

    // Let expire
    await this.wait(600);
    await service.deleteExpired(ExpiryUser);
    global.gc!();

    const finalMemory = process.memoryUsage().arrayBuffers;
    console.log('Final memory', finalMemory / KB);
    total = await this.getSize(ExpiryUser);
    assert(total === 0);
    assert(finalMemory / KB < 1); // Decreased by 50mb
  }
}

@Suite()
class MemoryPolymorphicSuite extends ModelPolymorphismSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}
