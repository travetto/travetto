import assert from 'node:assert';

import { TimeUtil } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ExpiryUser, ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';
import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';
import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';

import { MemoryModelConfig, MemoryModelService } from '../src/service.ts';

const KB = 2 ** 20;

@Suite()
export class MemoryBasicSuite extends ModelBasicSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryCrudSuite extends ModelCrudSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryBlobSuite extends ModelBlobSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryExpirySuite extends ModelExpirySuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;

  @Test({ skip: () => !global.gc })
  async ensureCulled() {
    const service = await this.service;

    let total;

    total = await this.getSize(ExpiryUser);
    assert(total === 0);

    const startMemory = process.memoryUsage().arrayBuffers;
    console.log('Start memory', startMemory / KB);

    // Create
    await service.upsert(ExpiryUser, ExpiryUser.from({
      expiresAt: TimeUtil.fromNow(500, 'ms'),
      payload: 'abcdefghij'.repeat(5 * KB) // 50mb
    }));

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
export class MemoryIndexedSuite extends ModelIndexedSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryPolymorphicSuite extends ModelPolymorphismSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}