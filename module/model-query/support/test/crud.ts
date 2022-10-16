import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { BaseModelSuite } from '@travetto/model/support/test/base';
import { ModelCrudSupport } from '@travetto/model/src/service/crud';

import { Address, Person } from './types';
import { ModelQueryCrudSupport } from '../../src/service/crud';

@Suite()
export abstract class ModelQueryCrudSuite extends BaseModelSuite<ModelQueryCrudSupport & ModelCrudSupport> {
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

    const c2 = await svc.deleteByQuery(Person, { where: 'age <= 3' });

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

    assert(await svc.queryCount(Person, { where: 'gender == "m"' }) === 5);

    const c = await svc.updateByQuery(Person, { where: { age: { $gt: 3 } } }, { gender: 'f' });

    assert((await svc.query(Person, {}))[0].address.street1 === 'street1');

    assert(c === 2);

    assert(await svc.queryCount(Person, { where: { gender: 'm' } }) === 3);

    const c2 = await svc.updateByQuery(Person, { where: 'gender == "m"' }, { gender: 'f' });

    assert(c2 === 3);

    assert(await svc.queryCount(Person, { where: { gender: 'f' } }) === 5);
    assert(await svc.queryCount(Person, { where: 'gender == "m"' }) === 0);

  }
}

