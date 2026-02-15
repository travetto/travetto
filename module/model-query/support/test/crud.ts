import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { type ModelCrudSupport, NotFoundError } from '@travetto/model';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import { Address, Person, Todo, BigIntModel } from './model.ts';
import type { ModelQueryCrudSupport } from '../../src/types/crud.ts';

@Suite()
export abstract class ModelQueryCrudSuite extends BaseModelSuite<ModelQueryCrudSupport & ModelCrudSupport> {
  @Test()
  async testUpdateOneWithQuery() {
    const svc = await this.service;

    const todo1 = await svc.create(Todo, Todo.from({ text: 'bob' }));

    assert(todo1.id);
    assert(todo1.version === 0);

    const todo1v2 = await svc.updateByQuery(Todo, Todo.from({
      id: todo1.id,
      text: `${todo1.text}!!`,
      version: todo1.version + 1
    }), { where: { id: todo1.id, version: todo1.version } },);

    assert(todo1v2.id === todo1.id);
    assert(todo1v2.version > todo1.version);

    await assert.rejects(
      () => svc.updateByQuery(Todo, Todo.from({
        id: todo1.id,
        text: `${todo1.text}!!`,
        version: todo1.version + 1
      }), { where: { id: todo1.id, version: todo1.version } }),
      NotFoundError
    );

    const todo2 = await svc.create(Todo, Todo.from({ text: 'bob2' }));

    const result = await svc.updateByQuery(Todo, Todo.from({
      id: todo2.id,
      text: `${todo1.text}!!`,
      version: todo1.version + 1
    }), { where: { id: todo2.id, text: 'bob2' } });

    assert(result.id === todo2.id);
  }

  @Test()
  async testUpdateOneWithQueryMultiple() {
    const svc = await this.service;

    const todo1 = await svc.create(Todo, Todo.from({ text: 'bob', version: 1 }));

    assert(todo1.id);
    assert(todo1.version === 1);

    const todo1v = ['a', 'b', 'c', 'd', 'e'].map(x => Todo.from({ ...todo1, text: `${todo1.text}-${x}`, version: todo1.version + 1 }));

    const promises = todo1v.map(x => svc.updateByQuery(Todo, x, { where: { version: todo1.version } }));

    const results = await Promise.allSettled(promises);
    const rejected = results.filter(x => x.status === 'rejected');
    const fulfilled = results.filter(x => x.status === 'fulfilled');

    for (const el of rejected) {
      assert(el.reason instanceof NotFoundError);
    }
    assert(fulfilled.length === 1);
    assert(rejected.length === todo1v.length - 1);

    const succeeded = fulfilled[0];
    assert(succeeded.value.id === todo1.id);
    assert(succeeded.value.version === todo1.version + 1);
    assert(succeeded.value.text !== todo1.text);

    const todo2 = await svc.get(Todo, todo1.id);
    assert.deepStrictEqual(todo2, succeeded.value);

    const promises2 = ['a', 'b', 'c', 'd', 'e'].map(x => Todo.from({ ...todo2, text: `${todo2.text}-${x}`, version: todo2.version + 2 }));
    const results2 = await Promise.allSettled(promises2.map(x => svc.updateByQuery(Todo, x, { where: { version: todo2.version + 1 } })));
    for (const el of results2) {
      assert(el.status === 'rejected');
      assert(el.reason instanceof NotFoundError);
    }
  }

  @Test()
  async testDeleteByQuery() {
    const svc = await this.service;

    const count = await this.saveAll(Person, [1, 2, 3, 4, 5].map(d => Person.from({
      age: d,
      gender: 'm',
      name: `Test ${d}`,
      address: Address.from({
        street1: 'street1',
        street2: 'street2'
      })
    })));

    assert(count === 5);

    const c = await svc.deleteByQuery(Person, { where: { age: { $gt: 3 } } });

    assert(c === 2);

    assert(await svc.queryCount(Person, {}) === 3);

    const c2 = await svc.deleteByQuery(Person, { where: { age: { $lte: 3 } } });

    assert(c2 === 3);

    assert(await svc.queryCount(Person, {}) === 0);

  }

  @Test()
  async testUpdateByQuery() {
    const svc = await this.service;

    const count = await this.saveAll(Person, [1, 2, 3, 4, 5].map(d => Person.from({
      age: d,
      gender: 'm',
      name: `Test ${d}`,
      address: Address.from({
        street1: 'street1',
        street2: 'street2'
      })
    })));

    assert(count === 5);

    assert(await svc.queryCount(Person, { where: { gender: 'm' } }) === 5);

    const c = await svc.updatePartialByQuery(Person, { where: { age: { $gt: 3 } } }, { gender: 'f' });

    assert((await svc.query(Person, {}))[0].address.street1 === 'street1');

    assert(c === 2);

    assert(await svc.queryCount(Person, { where: { gender: 'm' } }) === 3);

    const c2 = await svc.updatePartialByQuery(Person, { where: { gender: 'm' } }, { gender: 'f' });

    assert(c2 === 3);

    assert(await svc.queryCount(Person, { where: { gender: 'f' } }) === 5);
    assert(await svc.queryCount(Person, { where: { gender: 'm' } }) === 0);

  }

  @Test()
  async testBigIntQuery() {
    const svc = await this.service;

    // Create test data with various bigint values
    const count = await this.saveAll(BigIntModel, [
      BigIntModel.from({ largeNumber: 100n, optionalBigInt: 1000n }),
      BigIntModel.from({ largeNumber: 200n, optionalBigInt: 2000n }),
      BigIntModel.from({ largeNumber: 300n }),
      BigIntModel.from({ largeNumber: 9007199254740991n, optionalBigInt: 1234567890123456789n }),
      BigIntModel.from({ largeNumber: 18014398509481982n }),
    ]);

    assert(count === 5);

    // Test equality
    const exact = await svc.query(BigIntModel, { where: { largeNumber: 200n } });
    assert(exact.length === 1);
    assert(exact[0].largeNumber === 200n);
    assert(exact[0].optionalBigInt === 2000n);

    // Test greater than
    const greaterThan = await svc.query(BigIntModel, { where: { largeNumber: { $gt: 200n } } });
    assert(greaterThan.length === 3);
    assert(greaterThan.every(x => x.largeNumber > 200n));

    // Test less than or equal
    const lessThanOrEqual = await svc.query(BigIntModel, { where: { largeNumber: { $lte: 300n } } });
    assert(lessThanOrEqual.length === 3);
    assert(lessThanOrEqual.every(x => x.largeNumber <= 300n));

    // Test range query
    const range = await svc.query(BigIntModel, { where: { largeNumber: { $gte: 100n, $lte: 300n } } });
    assert(range.length === 3);
    assert(range.every(x => x.largeNumber >= 100n && x.largeNumber <= 300n));

    // Test with optional field
    const withOptional = await svc.query(BigIntModel, { where: { optionalBigInt: { $exists: true } } });
    assert(withOptional.length === 3);
    assert(withOptional.every(x => x.optionalBigInt !== undefined));

    // Test count with bigint condition
    const countResult = await svc.queryCount(BigIntModel, { where: { largeNumber: { $gte: 1000n } } });
    assert(countResult === 2);
  }

  @Test()
  async testBigIntUpdateByQuery() {
    const svc = await this.service;

    const count = await this.saveAll(BigIntModel, [
      BigIntModel.from({ largeNumber: 100n, optionalBigInt: 1000n }),
      BigIntModel.from({ largeNumber: 200n, optionalBigInt: 2000n }),
      BigIntModel.from({ largeNumber: 300n }),
    ]);

    assert(count === 3);

    // Update records with bigint condition
    const updated = await svc.updatePartialByQuery(
      BigIntModel,
      { where: { largeNumber: { $lte: 200n } } },
      { optionalBigInt: 5000n }
    );

    assert(updated === 2);

    // Verify updates
    const results = await svc.query(BigIntModel, { where: { optionalBigInt: 5000n } });
    assert(results.length === 2);
    assert(results.every(x => x.optionalBigInt === 5000n));
    assert(results.every(x => x.largeNumber <= 200n));
  }

  @Test()
  async testBigIntDeleteByQuery() {
    const svc = await this.service;

    const count = await this.saveAll(BigIntModel, [
      BigIntModel.from({ largeNumber: 100n }),
      BigIntModel.from({ largeNumber: 200n }),
      BigIntModel.from({ largeNumber: 300n }),
      BigIntModel.from({ largeNumber: 400n }),
      BigIntModel.from({ largeNumber: 500n }),
    ]);

    assert(count === 5);

    // Delete records with bigint condition
    const deleted = await svc.deleteByQuery(BigIntModel, { where: { largeNumber: { $gt: 300n } } });

    assert(deleted === 2);

    // Verify deletions
    const remaining = await svc.queryCount(BigIntModel, {});
    assert(remaining === 3);

    const all = await svc.query(BigIntModel, {});
    assert(all.every(x => x.largeNumber <= 300n));
  }
}

