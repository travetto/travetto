import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Schema, Text, Precision, TypeMismatchError } from '@travetto/schema';

import { BaseModelSuite } from './base';
import { ModelCrudSupport, Model, BaseModel, NotFoundError } from '..';
import { SubTypeNotSupportedError } from '../src/error/invalid-sub-type';

@Schema()
class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model('crud-person')
class Person extends BaseModel {
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
}

@Model()
class Dated {
  id: string;
  time?: Date;
}

@Suite()
export abstract class ModelCrudSuite extends BaseModelSuite<ModelCrudSupport> {

  @Test('save it')
  async save() {
    const service = await this.service;

    const people = [1, 2, 3, 8].map(x => Person.from({
      id: service.uuid(),
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
      await service.get(Person, service.uuid());
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

    const o2 = await service.updatePartial(Person, Person.from({
      id: o.id,
      name: 'oscar'
    }));

    assert(o2.name === 'oscar');
    assert(o2.age === 20);
    assert(o2.address.street2 === 'roader');

    await service.updatePartial(Person, Person.from({
      id: o2.id,
      gender: 'f',
      address: {
        street1: 'changed\n',
        street2: undefined
      }
    }));

    const o3 = await service.get(Person, o.id);

    assert(o3.name === 'oscar');
    assert(o3.age === 20);
    assert(o3.gender === 'f');
    assert(o3.address.street1 === 'changed\n');
    assert(!('street2' in o3.address));
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

    const o2 = await service.updatePartial(SimpleList, SimpleList.from({
      id: o.id,
      names: ['a', 'd'],
      simples: [{ name: 'd' }]
    }));

    assert(o2.names === ['a', 'd']);
    assert(o2.simples === [SimpleItem.from({ name: 'd' })]);
  }

  @Test('Verify partial update with field removal and lists')
  async testBlankPartialUpdate() {
    const service = await this.service;
    const o = await service.create(User2, User2.from({
      name: 'bob'
    }));

    assert(o.address === undefined);

    await service.updatePartial(User2, User2.from({
      id: o.id,
      address: {
        street1: 'blue'
      }
    }));

    const o3 = await service.get(User2, o.id);

    assert(o3.address !== undefined);
    assert(o3.address!.street1 === 'blue');
  }

  @Test('verify dates')
  async testDates() {
    const service = await this.service;
    const res = await service.create(Dated, Dated.from({ time: new Date() }));

    assert(res.time instanceof Date);
  }
}