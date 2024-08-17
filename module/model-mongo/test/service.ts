import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Index, Model } from '@travetto/model';

import { ModelBasicSuite } from '@travetto/model/support/test/basic';
import { ModelCrudSuite } from '@travetto/model/support/test/crud';
import { ModelBulkSuite } from '@travetto/model/support/test/bulk';
import { ModelIndexedSuite } from '@travetto/model/support/test/indexed';
import { ModelExpirySuite } from '@travetto/model/support/test/expiry';
import { ModelPolymorphismSuite } from '@travetto/model/support/test/polymorphism';
import { ModelBlobSuite } from '@travetto/model/support/test/blob';

import { MongoModelConfig } from '../src/config';
import { MongoModelService } from '../src/service';

@Suite()
export class MongoBasicSuite extends ModelBasicSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Test()
  async testId() {
    const svc = await this.service;
    const user = await svc.create(UniqueUser, UniqueUser.from({ name: 'bob' }));
    assert(user.id.length === 32);
  }
}

@Suite()
export class MongoCrudSuite extends ModelCrudSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoExpirySuite extends ModelExpirySuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoBlobSuite extends ModelBlobSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}

@Suite()
export class MongoBulkSuite extends ModelBulkSuite {
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
export class MongoIndexedSuite extends ModelIndexedSuite {
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
export class MongoPolymorphismSuite extends ModelPolymorphismSuite {
  serviceClass = MongoModelService;
  configClass = MongoModelConfig;
}