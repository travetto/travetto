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

  @Test('Polymorphic create and find')
  async polymorphicCreateAndFind() {
    const service = await this.service;
    const people = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];
    const [doc, fire, eng] = await Promise.all(people.map(p => service.create(Worker, p)));

    assert(doc instanceof Doctor);

    await assert.rejects(
      () => service.get(Engineer, doc.id),
      NotFoundError);

    assert(doc instanceof Doctor);
    assert(fire instanceof Firefighter);
    assert(eng instanceof Engineer);

    const doc2 = await service.get(Worker, doc.id);
    assert(doc2 instanceof Doctor);
    const fire2 = await service.get(Worker, fire.id);
    assert(fire2 instanceof Firefighter);

    const all = await collect(service.list(Worker));
    assert(all.length === 3);

    const doc3 = all.find(x => x instanceof Doctor);
    assert(doc3 instanceof Doctor);
    assert(doc3.specialty === 'feet');
    assert(doc3.name === 'bob');

    const fire3 = all.find(x => x instanceof Firefighter);
    assert(fire3 instanceof Firefighter);
    assert((fire3 as Firefighter).firehouse === 20);
    assert(fire3.name === 'rob');

    const eng3 = all.find(x => x instanceof Engineer);
    assert(eng3 instanceof Engineer);
    assert((eng3 as Engineer).major === 'oranges');
    assert(eng3.name === 'cob');

    const engineers = await collect(service.list(Engineer));
    assert(engineers.length === 1);

    await service.create(Engineer, Engineer.from({
      major: 'foodService',
      name: 'bob2'
    }));

    const engineers2 = await collect(service.list(Engineer));
    assert(engineers2.length === 2);
  }

  @Test('Polymorphic upsert and delete')
  async polymorphicUpsertAndDelete() {
    const service = await this.service;
    const [doc, fire, eng] = [
      Doctor.from({ name: 'bob', specialty: 'feet' }),
      Firefighter.from({ name: 'rob', firehouse: 20 }),
      Engineer.from({ name: 'cob', major: 'oranges' })
    ];

    await this.saveAll(Worker, [doc, fire, eng]);

    assert(await service.get(Worker, doc.id) instanceof Doctor);
    assert(await service.get(Worker, fire.id) instanceof Firefighter);

    const update = new Date();

    await assert.rejects(
      () =>
        service.upsert(Doctor, Doctor.from({
          id: fire.id, name: 'drob', specialty: 'eyes'
        })),
      SubTypeNotSupportedError
    );

    await assert.rejects(
      // @ts-expect-error
      () => service.update(Engineer, Doctor.from({ ...doc })),
      (e: Error) => (e instanceof NotFoundError || e instanceof SubTypeNotSupportedError) ? undefined : e);

    try {
      const res = await service.upsert(Doctor, Doctor.from({
        id: doc.id, name: 'drob', specialty: 'eyes'
      }));

      assert(res.updatedDate!.getTime() > update.getTime());
    } catch (err) {
      assert(err instanceof SubTypeNotSupportedError);
    }

    const resAlt = await service.upsert(Worker, Doctor.from({
      id: doc.id, name: 'drob', specialty: 'eyes'
    }));

    assert(resAlt.updatedDate!.getTime() > update.getTime());

    // Delete by wrong class
    await assert.rejects(
      () => service.delete(Doctor, fire.id),
      SubTypeNotSupportedError
    );

    // Delete by base class
    await service.delete(Worker, fire.id);

    await assert.rejects(
      () => service.delete(Worker, fire.id),
      NotFoundError
    );

    // Delete by any subtype when id is missing
    await assert.rejects(
      () => service.delete(Firefighter, doc.id),
      SubTypeNotSupportedError
    );
  }
}