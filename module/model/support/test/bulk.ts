import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Model } from '../../src/registry/decorator.ts';
import { ModelBulkSupport } from '../../src/types/bulk.ts';
import { BaseModelSuite } from './base.ts';

@Model('bulk-user')
class User {
  id: string;
  name?: string;
}

@Suite()
export abstract class ModelBulkSuite extends BaseModelSuite<ModelBulkSupport> {

  @Test()
  async bulkInsert() {
    const service = await this.service;
    const result = await service.processBulk(User, [
      { insert: User.from({}) },
      { insert: User.from({}) },
      { insert: User.from({}) },
      { insert: User.from({}) }
    ]);

    assert(result.counts.insert === 4);
    assert(result.insertedIds.size === 4);
  }

  @Test()
  async bulkUpsert() {
    const service = await this.service;
    const result = await service.processBulk(User, [
      { upsert: User.from({}) },
      { upsert: User.from({}) },
      { upsert: User.from({}) },
      { upsert: User.from({}) }
    ]);

    assert(result.counts.upsert === 4);
    assert(result.insertedIds.size === 4);
  }

  @Test()
  async bulkUpdate() {
    const service = await this.service;
    const users = [0, 1, 2, 4].map(x => User.from({ name: `name-${x}`, id: service.idSource.create() }));

    const result = await service.processBulk(User, users.map(u => ({ insert: u })));
    assert(result.counts.insert === 4);
    assert(result.insertedIds.size === 4);

    const res2 = await service.processBulk(User, users.map(u => ({ update: u })));
    assert(res2.counts.update === 4);
    assert(res2.insertedIds.size === 0);
  }

  @Test()
  async bulkDelete() {
    const service = await this.service;
    const users = [0, 1, 2, 4].map(x => User.from({ name: `name-${x}`, id: service.idSource.create() }));

    const result = await service.processBulk(User, users.map(u => ({ insert: u })));
    assert(result.counts.insert === 4);
    assert(result.insertedIds.size === 4);

    const res2 = await service.processBulk(User, users.map(u => ({ delete: u })));
    assert(res2.counts.delete === 4);
  }
}
