import assert from 'node:assert';
import timers from 'node:timers/promises';

import { Suite, Test } from '@travetto/test';
import { Schema, Text, Precision, Required, } from '@travetto/schema';
import { type ModelCrudSupport, Model, NotFoundError, PersistValue } from '@travetto/model';

import { BaseModelSuite } from './base.ts';

@Schema()
class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model('crud-person')
class Person {
  id: string;
  @Text() name: string;
  @Precision(3, 0)
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Model()
class Simple {
  id: string;
  name: string;
}

@Schema()
class SimpleItem {
  name: string;
}

@Model()
class SimpleList {
  id: string;
  names: string[];
  simples?: SimpleItem[];
}

@Model()
class User2 {
  id: string;
  address?: Address;
  name: string;

  prePersist() {
    this.name = `${this.name}-suffix`;
  }
}

@Model()
class Dated {
  id: string;

  value?: string;

  @PersistValue(v => v ?? new Date(), 'full')
  @Required(false)
  createdDate: Date;

  @PersistValue(v => new Date())
  @Required(false)
  updatedDate: Date;
}

@Model()
class BigIntModel {
  id: string;
  largeNumber: bigint;
  optionalBigInt?: bigint;
}

@Suite()
export abstract class ModelCrudSuite extends BaseModelSuite<ModelCrudSupport> {

  @Test('save it')
  async save() {
    const service = await this.service;

    const people = [1, 2, 3, 8].map(x => Person.from({
      id: service.idSource.create(),
      name: 'Bob',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    }));

    await Promise.all(
      people.map(el => service.upsert(Person, el))
    );

    const single = await service.get(Person, people[2].id);
    assert(single !== undefined);
    assert(single.age === 23);

    await assert.rejects(async () => {
      await service.get(Person, service.idSource.create());
    }, NotFoundError);
  }

  @Test('Verify update')
  async testUpdate() {
    const service = await this.service;
    const o = await service.create(Simple, Simple.from({ name: 'bob' }));
    o.name = 'roger';
    const b = await service.update(Simple, o);
    const id = b.id;

    const z = await service.get(Simple, id);

    assert(z.name === 'roger');
  }

  @Test('Verify partial update with field removal')
  async testPartialUpdate() {
    const service = await this.service;
    const o = await service.create(Person, Person.from({
      name: 'bob',
      age: 20,
      gender: 'm',
      address: {
        street1: 'road',
        street2: 'roader'
      }
    }));
    assert(o.id);
    assert(o.name === 'bob');

    const o2 = await service.updatePartial(Person, {
      id: o.id,
      name: 'oscar'
    });

    assert(o2.name === 'oscar');
    assert(o2.age === 20);
    assert(o2.address.street2 === 'roader');

    await service.updatePartial(Person, {
      id: o2.id,
      gender: 'f',
      address: {
        street1: 'changed\n',
      }
    });

    const o3 = await service.get(Person, o.id);

    assert(o3.name === 'oscar');
    assert(o3.age === 20);
    assert(o3.gender === 'f');
    assert(o3.address.street1 === 'changed\n');
    assert(!('street2' in o3.address));
  }

  @Test('Verify update partial on missing item fails')
  async testMissingUpdatePartial() {
    const service = await this.service;
    await assert.rejects(() => service.updatePartial(User2, { id: '-1', name: 'bob' }), NotFoundError);
  }

  @Test('Verify partial update with field removal and lists')
  async testPartialUpdateList() {
    const service = await this.service;
    const o = await service.create(SimpleList, SimpleList.from({
      names: ['a', 'b', 'c'],
      simples: [
        {
          name: 'a',
        },
        {
          name: 'b',
        },
        {
          name: 'c',
        }
      ]
    }));

    const o2 = await service.updatePartial(SimpleList, {
      id: o.id,
      names: ['a', 'd'],
      simples: [{ name: 'd' }]
    });

    assert.deepStrictEqual(o2.names, ['a', 'd']);
    assert.deepStrictEqual(o2.simples, [SimpleItem.from({ name: 'd' })]);
  }

  @Test('Verify partial update with field removal and lists')
  async testBlankPartialUpdate() {
    const service = await this.service;
    const o = await service.create(User2, User2.from({
      name: 'bob',
    }));

    assert(o.address === undefined);
    assert(o.name === 'bob-suffix');

    await service.updatePartial(User2, {
      id: o.id,
      address: {
        street1: 'blue'
      }
    });

    const o3 = await service.get(User2, o.id);

    assert(o3.address !== undefined);
    assert(o3.address.street1 === 'blue');
    assert(o3.address.street2 === undefined);
  }

  @Test('verify dates')
  async testDates() {
    const service = await this.service;
    const result = await service.create(Dated, Dated.from({ createdDate: new Date() }));

    assert(result.createdDate instanceof Date);
  }

  @Test('verify pre-persist on create/update')
  async testPrePersist() {
    const service = await this.service;
    const result = await service.create(Dated, Dated.from({}));
    const created = result.createdDate;
    assert(result.createdDate instanceof Date);
    assert(result.updatedDate instanceof Date);

    await timers.setTimeout(100);

    const final = await service.updatePartial(Dated, { id: result.id, value: 'random' });
    assert(final.createdDate instanceof Date);
    assert(final.createdDate.getTime() === created?.getTime());
    assert(final.updatedDate instanceof Date);
    assert(final.createdDate.getTime() < final.updatedDate?.getTime());
  }

  @Test('verify list')
  async list() {
    const service = await this.service;

    const people = [1, 2, 3].map(x => Person.from({
      id: service.idSource.create(),
      name: 'Bob',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    }));

    await Promise.all(
      people.map(el => service.upsert(Person, el))
    );

    const found = (await this.toArray(service.list(Person))).toSorted((a, b) => a.age - b.age);

    assert(found[0].age === people[0].age);
    assert(found[1].age === people[1].age);
    assert(found[2].age === people[2].age);
  }

  @Test('save it')
  async verifyRaw() {
    const service = await this.service;

    const people = await Promise.all(
      [1, 2, 3, 8].map((x, i) => service[i % 2 === 0 ? 'upsert' : 'create'](Person, {
        name: 'Bob',
        age: 20 + x,
        gender: 'm',
        address: {
          street1: 'a',
          ...(x === 1 ? { street2: 'b' } : {})
        }
      }))
    );

    const single = await service.get(Person, people[2].id);
    assert(single !== undefined);
    assert(single.age === 23);
  }

  @Test('Verify update')
  async testRawUpdate() {
    const service = await this.service;
    const o = await service.create(Simple, { name: 'bob' });
    const b = await service.update(Simple, { id: o.id, name: 'roger' });
    const id = b.id;

    const z = await service.get(Simple, id);

    assert(z.name === 'roger');
  }

  @Test('Verify partial update with field removal')
  async testRawPartialUpdate() {
    const service = await this.service;
    const o = await service.create(Person, {
      name: 'bob',
      age: 20,
      gender: 'm',
      address: {
        street1: 'road',
        street2: 'roader'
      }
    });
    assert(o.id);
    assert(o.name === 'bob');

    const o2 = await service.updatePartial(Person, {
      id: o.id,
      name: 'oscar'
    });

    assert(o2.name === 'oscar');
    assert(o2.age === 20);
    assert(o2.address.street2 === 'roader');
  }

  @Test('Verify nested list in partial update')
  async testPartialUpdateOnLists() {
    const service = await this.service;
    const o = await service.create(SimpleList, {
      names: ['rob', 'tom'],
      simples: [
        { name: 'roger' },
        { name: 'dodger' }
      ]
    });
    assert(o.names.length === 2);
    assert(o.simples);
    assert(o.simples.length === 2);

    const o2 = await service.updatePartial(SimpleList, {
      id: o.id,
      names: ['dawn'],
      simples: [{ name: 'jim' }]
    });

    assert(o2.names.length === 1);
    assert(o2.simples);
    assert(o2.simples.length === 1);
  }

  @Test('Verify bigint storage and retrieval')
  async testBigIntReadWrite() {
    const service = await this.service;

    // Create with bigint values
    const created = await service.create(BigIntModel, BigIntModel.from({
      largeNumber: 9007199254740991n, // Number.MAX_SAFE_INTEGER as bigint
      optionalBigInt: 1234567890123456789n
    }));

    assert(created.id);
    assert.strictEqual(created.largeNumber, 9007199254740991n);
    assert.strictEqual(created.optionalBigInt, 1234567890123456789n);

    // Retrieve and verify
    const retrieved = await service.get(BigIntModel, created.id);
    assert.strictEqual(retrieved.largeNumber, 9007199254740991n);
    assert.strictEqual(retrieved.optionalBigInt, 1234567890123456789n);

    // Update with new bigint value
    const updated = await service.update(BigIntModel, BigIntModel.from({
      id: created.id,
      largeNumber: 18014398509481982n,
      optionalBigInt: undefined
    }));

    assert.strictEqual(updated.largeNumber, 18014398509481982n);
    assert.strictEqual(updated.optionalBigInt, undefined);

    // Verify update persisted
    const final = await service.get(BigIntModel, created.id);
    assert.strictEqual(final.largeNumber, 18014398509481982n);
    assert(!final.optionalBigInt);
  }
}