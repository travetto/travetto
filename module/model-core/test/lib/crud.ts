import * as assert from 'assert';

import { AfterEach, BeforeAll, BeforeEach, Test } from '@travetto/test';
import { Schema, Text, Precision } from '@travetto/schema';

import { BaseModelTest } from './test.base';
import { Model, BaseModel } from '../..';

@Schema()
class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model()
class Person extends BaseModel {
  @Text() name: string;
  @Precision(3, 0)
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Model()
class Simple {
  id?: string;
  name: string;
}

@Model()
class SimpleList {
  id?: string;
  names: string[];
  simples?: Simple[];
}

@Model()
class User2 {
  id?: string;
  address?: Address;
  name: string;
}

@Model()
class Dated {
  id?: string;
  time?: Date;
}

@Model({ baseType: true })
export class Worker extends BaseModel {
  name: string;
}

@Model()
export class Doctor extends Worker {
  specialty: string;
}

@Model()
export class Firefighter extends Worker {
  firehouse: number;
}

@Model()
export class Engineer extends Worker {
  major: string;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out = [] as T[];
  for await (const el of iterable) {
    out.push(el);
  }
  return out;
}

export class ModelCrudSuite extends BaseModelTest {

  @BeforeAll()
  async beforeAll() {
    return super.init();
  }

  @BeforeEach()
  async beforeEach() {
    return this.initDb();
  }

  @AfterEach()
  async afterEach() {
    return this.cleanup();
  }

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

    const single = await service.get(Person, people[2].id!);
    assert(single !== undefined);
    assert(single.age === 23);

    await assert.rejects(async () => {
      await service.get(Person, service.uuid());
    }, /not found/);
  }

  @Test('Verify update')
  async testUpdate() {
    const service = await this.service;
    const o = await service.create(Simple, Simple.from({ name: 'bob' }));
    o.name = 'roger';
    const b = await service.update(Simple, o);
    const id = b.id!;

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

    const o2 = await service.updatePartial(Person, o.id, Person.from({
      name: 'oscar'
    }));

    assert(o2.name === 'oscar');
    assert(o2.age === 20);
    assert(o2.address.street2 === 'roader');

    await service.updatePartial(Person, o2.id!, Person.from({
      gender: 'f',
      address: {
        street1: 'changed\n',
        street2: undefined
      }
    }));

    const o3 = await service.get(Person, o.id!);

    assert(o3.name === 'oscar');
    assert(o3.age === 20);
    assert(o3.gender === 'f' as any);
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

    const o2 = await service.updatePartial(SimpleList, o.id!, SimpleList.from({
      names: ['a', 'd'],
      simples: [{ name: 'd' }]
    }));

    assert(o2.names === ['a', 'd']);
    assert(o2.simples === [Simple.from({ name: 'd' })]);
  }

  @Test('Verify partial update with field removal and lists')
  async testBlankPartialUpdate() {
    const service = await this.service;
    const o = await service.create(User2, User2.from({
      name: 'bob'
    }));

    assert(o.address === undefined);

    await service.updatePartial(User2, o.id!, User2.from({
      address: {
        street1: 'blue'
      }
    }));

    const o3 = await service.get(User2, o.id!);

    assert(o3.address !== undefined);
    assert(o3.address!.street1 === 'blue');
  }

  @Test('verify dates')
  async testDates() {
    const service = await this.service;
    const res = await service.create(Dated, Dated.from({ time: new Date() }));

    assert(res.time instanceof Date);
  }

  @Test('Verify save and find and deserialize')
  async testPolymorphism() {
    const service = await this.service;
    const people = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];
    const o = await Promise.all(people.map(p => service.create(Worker, p)));

    assert(o[0] instanceof Doctor);
    await assert.rejects(
      async () => service.update(Engineer, Doctor.from({ ...o[0] }) as any),
      'Expected object of type Engineer');

    await assert.rejects(
      async () => service.get(Engineer, o[0].id!),
      'Invalid number');

    assert(o[0] instanceof Doctor);
    assert(o[1] instanceof Firefighter);
    assert(o[2] instanceof Engineer);

    const o2 = await service.get(Worker, o[0].id!);
    assert(o2 instanceof Doctor);
    const o3 = await service.get(Worker, o[1].id!);
    assert(o3 instanceof Firefighter);

    const all = await collect(service.list(Worker));
    assert(all.length === 3);

    const dIdx = all.findIndex(x => x instanceof Doctor);
    assert(all[dIdx] instanceof Doctor);
    assert((all[dIdx] as Doctor).specialty === 'feet');
    assert(all[dIdx].name === 'bob');

    const fIdx = all.findIndex(x => x instanceof Firefighter);
    assert(all[fIdx] instanceof Firefighter);
    assert((all[fIdx] as Firefighter).firehouse === 20);
    assert(all[fIdx].name === 'rob');

    const eIdx = all.findIndex(x => x instanceof Engineer);
    assert(all[eIdx] instanceof Engineer);
    assert((all[eIdx] as Engineer).major === 'oranges');
    assert(all[eIdx].name === 'cob');

    const engineers = await collect(service.list(Engineer));
    assert(engineers.length === 1);

    await service.create(Engineer, Engineer.from({
      major: 'foodService',
      name: 'bob2'
    }));

    const engineers2 = await collect(service.list(Engineer));
    assert(engineers2.length === 2);
  }

}