import assert from 'node:assert';

import { DependencyRegistryIndex } from '@travetto/di';
import { FirestoreModelConfig, FirestoreModelService } from '@travetto/model-firestore';
import { Util } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { CustomIdModel, ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';

@Suite()
class FirestoreBasicSuite extends ModelBasicSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}

@Suite()
class FirestoreCrudSuite extends ModelCrudSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;

  @Test('Verify update creates when readBeforeUpdate is false')
  async testUpdateWithoutReadBeforeUpdate() {
    const service = await this.service;
    const config = await DependencyRegistryIndex.getInstance(this.configClass);
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
class FirestorePolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = FirestoreModelService;
  configClass = FirestoreModelConfig;
}
