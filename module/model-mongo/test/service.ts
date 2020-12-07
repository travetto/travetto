import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ModelCrudSuite } from '@travetto/model-core/test/lib/crud';
import { ModelStreamSuite } from '@travetto/model-core/test/lib/stream';
import { ModelBulkSuite } from '@travetto/model-core/test/lib/bulk';
import { ModelIndexedSuite } from '@travetto/model-core/test/lib/indexed';
import { Index, Model } from '@travetto/model-core';

import { MongoModelConfig, MongoModelService } from '..';

@Suite()
export class MongoCrudSuite extends ModelCrudSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoStreamSuite extends ModelStreamSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Suite()
export class MongoBulkSuite extends ModelBulkSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

@Model()
@Index({
  name: 'uniqueUser',
  fields: [{ name: 1 }],
  unique: true
})
class UniqueUser {
  id: string;
  name: string;
}

@Suite()
export class MongoIndexedSuite extends ModelIndexedSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }

  @Test()
  async testUnique() {
    const svc = await this.service;
    await svc.create(UniqueUser, UniqueUser.from({ name: 'bob' }));
    await assert.rejects(() => svc.create(UniqueUser, UniqueUser.from({ name: 'bob' })), /duplicate/i);
  }
}