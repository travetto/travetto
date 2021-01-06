import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Index, Model } from '@travetto/model';

import { ModelBasicSuite } from '@travetto/model/test-support/basic';
import { ModelCrudSuite } from '@travetto/model/test-support/crud';
import { ModelStreamSuite } from '@travetto/model/test-support/stream';
import { ModelBulkSuite } from '@travetto/model/test-support/bulk';
import { ModelIndexedSuite } from '@travetto/model/test-support/indexed';

import { MongoModelConfig, MongoModelService } from '..';

@Suite()
export class MongoBasicSuite extends ModelBasicSuite {
  constructor() {
    super(MongoModelService, MongoModelConfig);
  }
}

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