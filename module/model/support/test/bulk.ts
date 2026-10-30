import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { Model } from '../../src/registry/decorator.ts';
import type { ModelBulkSupport } from '../../src/types/bulk.ts';
import { ModelBulkUtil } from '../../src/util/bulk.ts';
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
    const users = [0, 1, 2, 4].map(x => User.from({ name: `name-${x}` }));

    const result = await service.processBulk(
      User,
      users.map(u => ({ insert: u }))
    );
    assert(result.counts.insert === 4);
    assert(result.insertedIds.size === 4);

    const res2 = await service.processBulk(
      User,
      users.map(u => ({ update: u }))
    );
    assert(res2.counts.update === 4);
    assert(res2.insertedIds.size === 0);
  }

  @Test()
  async bulkDelete() {
    const service = await this.service;
    const users = [0, 1, 2, 4].map(x => User.from({ name: `name-${x}` }));

    const result = await service.processBulk(
      User,
      users.map(u => ({ insert: u }))
    );
    assert(result.counts.insert === 4);
    assert(result.insertedIds.size === 4);

    const res2 = await service.processBulk(
      User,
      users.map(u => ({ delete: u }))
    );
    assert(res2.counts.delete === 4);
  }

  @Test()
  async bulkUpdateMissingId() {
    const service = await this.service;
    await assert.rejects(() => service.processBulk(User, [{ update: User.from({ name: 'no-id' }) }]));
  }

  @Test()
  async bulkDeleteMissingId() {
    const service = await this.service;
    await assert.rejects(() => service.processBulk(User, [{ delete: User.from({ name: 'no-id' }) }]));
  }

  @Test()
  async bulkAsyncIterable() {
    const service = await this.service;
    async function* operations() {
      for (let i = 0; i < 5; i++) {
        yield { insert: User.from({ name: `stream-${i}` }) };
      }
    }

    const result = await service.processBulk(User, operations(), 2);
    assert(result.counts.insert === 5);
    assert(result.insertedIds.size === 5);
  }

  @Test()
  async bulkImportStream() {
    const service = await this.service;
    async function* objects() {
      for (let i = 0; i < 5; i++) {
        yield { name: `import-${i}` };
      }
    }

    const result = await ModelBulkUtil.import(service, User, objects(), { batchSize: 2 });
    assert(result.counts.upsert === 5);
    assert(result.insertedIds.size === 5);
  }

  @Test()
  async bulkItemsDirectly() {
    const service = await this.service;
    const users = [0, 1, 2, 3].map(x => User.from({ name: `direct-${x}` }));
    const result = await service.processBulk(User, users);
    assert(result.counts.upsert === 4);
    assert(result.insertedIds.size === 4);
  }

  @Test()
  async bulkItemsAsyncIterableDirectly() {
    const service = await this.service;
    async function* users() {
      for (let i = 0; i < 4; i++) {
        yield User.from({ name: `stream-direct-${i}` });
      }
    }
    const result = await service.processBulk(User, users(), 2);
    assert(result.counts.upsert === 4);
    assert(result.insertedIds.size === 4);
  }
}
