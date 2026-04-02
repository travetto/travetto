import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { QueryIndex } from '@travetto/model-query';
import { Model } from '@travetto/model';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';


@Model()
@QueryIndex({
  name: 'uniqueUser2',
  fields: [{ name: true }],
  type: 'query:unique'
})
class UniqueUser2 {
  id: string;
  name: string;
}

@Suite()
class MongoIndexedSuite extends ModelIndexedSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Test()
  async testUnique() {
    const svc = await this.service;
    await svc.create(UniqueUser2, UniqueUser2.from({ name: 'bob' }));
    await assert.rejects(() => svc.create(UniqueUser2, UniqueUser2.from({ name: 'bob' })), /duplicate/i);
  }
}


@Suite()
class MongoIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
