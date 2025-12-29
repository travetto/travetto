import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Index, Model } from '@travetto/model';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';

import { ModelBasicSuite } from '@travetto/model/support/test/basic.ts';
import { ModelCrudSuite } from '@travetto/model/support/test/crud.ts';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk.ts';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed.ts';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry.ts';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism.ts';
import { ModelBlobSuite } from '@travetto/model/support/test/blob.ts';

@Suite()
class MongoBasicSuite extends ModelBasicSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Test()
  async testId() {
    const svc = await this.service;
    const user = await svc.create(UniqueUser, UniqueUser.from({ name: 'bob' }));
    assert(user.id.length === 32);
  }

  @Test()
  async upsert() {
    const svc = await this.service;
    const user = await svc.upsert(UniqueUser, UniqueUser.from({ name: 'bob', id: svc.idSource.create() }));
    assert(user.id.length === 32);

    const found = await svc.get(UniqueUser, user.id);
    assert(found.id === user.id);
  }
}

@Suite()
class MongoCrudSuite extends ModelCrudSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
class MongoExpirySuite extends ModelExpirySuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
class MongoBlobSuite extends ModelBlobSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
class MongoBulkSuite extends ModelBulkSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Model()
@Index({
  name: 'uniqueUser',
  fields: [{ name: true }],
  type: 'unique'
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
class MongoPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}