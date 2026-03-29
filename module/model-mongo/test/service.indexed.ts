import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism';
import { QueryIndex } from '@travetto/model-query';
import { Model } from '@travetto/model';


@Model()
@QueryIndex({
  name: 'uniqueUser',
  fields: [{ name: true }],
  type: 'query:unique'
})
class UniqueUser {
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
    await svc.create(UniqueUser, UniqueUser.from({ name: 'bob' }));
    await assert.rejects(() => svc.create(UniqueUser, UniqueUser.from({ name: 'bob' })), /duplicate/i);
  }
}


@Suite()
class MongoIndexedPolymorphicdSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}
