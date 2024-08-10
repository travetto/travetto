import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { ModelCrudSupport } from '@travetto/model/src/service/crud';
import { NotFoundError } from '@travetto/model';

import { Address, Person, Todo } from './types';
import { ModelQueryCrudSupport } from '../../src/service/crud';

@Suite()
export abstract class ModelQueryCrudSuite extends BaseModelSuite<ModelQueryCrudSupport & ModelCrudSupport> {
  @Test()
  async testUpdateOneWithQuery() {
    const svc = await this.service;

    const todo1 = await svc.create(Todo, Todo.from({ text: 'bob' }));

    assert(todo1.id);
    assert(todo1.version === 0);

    const todo1v2 = await svc.updateOneWithQuery(Todo, Todo.from({
      id: todo1.id,
      text: `${todo1.text}!!`,
      version: todo1.version + 1
    }), { where: { id: todo1.id, version: todo1.version } },);

    assert(todo1v2.id === todo1.id);
    assert(todo1v2.version > todo1.version);

    await assert.rejects(
      () => svc.updateOneWithQuery(Todo, Todo.from({
        id: todo1.id,
        text: `${todo1.text}!!`,
        version: todo1.version + 1
      }), { where: { id: todo1.id, version: todo1.version } }),
      NotFoundError
    );


    const todo2 = await svc.create(Todo, Todo.from({ text: 'bob2' }));

    const result = await svc.updateOneWithQuery(Todo, Todo.from({
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

    const promises = todo1v.map(x => svc.updateOneWithQuery(Todo, x, { where: { version: todo1.version } }));

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
    const results2 = await Promise.allSettled(promises2.map(x => svc.updateOneWithQuery(Todo, x, { where: { version: todo2.version + 1 } })));
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

    const c = await svc.updateByQuery(Person, { where: { age: { $gt: 3 } } }, { gender: 'f' });

    assert((await svc.query(Person, {}))[0].address.street1 === 'street1');

    assert(c === 2);

    assert(await svc.queryCount(Person, { where: { gender: 'm' } }) === 3);

    const c2 = await svc.updateByQuery(Person, { where: { gender: 'm' } }, { gender: 'f' });

    assert(c2 === 3);

    assert(await svc.queryCount(Person, { where: { gender: 'f' } }) === 5);
    assert(await svc.queryCount(Person, { where: { gender: 'm' } }) === 0);

  }
}

