import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { Schema, Min, Max } from '@travetto/schema';
import { GenerateUtil } from '@travetto/schema/src/extension/faker.ext';

import { MongoModelSource } from '../';
import { BaseMongoTest } from './base';

@Schema()
class Address {
  street1: string;
  street2?: string;
}

@Model()
class Person extends BaseModel {
  name: string;
  @Max(200) @Min(0) age: number;
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

@Suite('Simple Save')
class TestSave extends BaseMongoTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);
    assert.ok(source);

    assert(source instanceof MongoModelSource);
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);

    for (const x of [1, 2, 3, 8]) {
      const person = GenerateUtil.generate(Person);
      delete person.id;
      const res = await service.save(Person, person);
    }

    const match = await service.getAllByQuery(Person, {
      where: {
        $and: [
          {
            name: { $exists: true }
          },
          {
            age: { $gte: 0 }
          }
        ]
      }
    });

    assert(match.length === 4);

    const match2 = await service.getAllByQuery(Person, {
      where: {
        $and: [
          {
            address: {
              street1: {
                $ne: 'b',
              }
            }
          }
        ]
      }
    });

    assert(match2.length > 3);

    const match3 = await service.query(Person, {
      select: {
        id: 1,
        address: {
          street1: 1
        }
      },
      where: {
        address: {
          street2: {
            $exists: true
          }
        }
      }
    });

    assert(match3.length > 0);
    assert(Object.keys(match3[0]).includes('address'));
    assert(!Object.keys(match3[0]).includes('age'));
    assert(Object.keys(match3[0]).includes('id'));
    // assert(!Object.keys(match3[0].address).includes('street2'));
    assert(Object.keys(match3[0].address).includes('street1'));
  }

  @Test('Verify update')
  async testUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const o = await service.save(Simple, Simple.from({ name: 'bob' }));
    o.name = 'roger';
    const b = await service.update(Simple, o);
    const id = b.id!;

    const z = await service.getById(Simple, id);

    assert(z.name === 'roger');
  }

  @Test('Verify autocomplete')
  async testAutocomplete() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const names = ['Bob', 'Bo', 'Barry', 'Rob', 'Robert', 'Robbie'];
    const res = await service.bulkProcess(Person,
      [0, 1, 2, 3, 4, 5].map(x => ({
        upsert: Person.from({
          name: names[x],
          age: 20 + x,
          gender: 'm',
          address: {
            street1: 'a',
            ...(x === 1 ? { street2: 'b' } : {})
          }
        })
      }))
    );

    let suggested = await service.suggestField(Person, 'name', 'bo');
    assert(suggested.length === 2);

    suggested = await service.suggestField(Person, 'name', 'b');
    assert(suggested.length === 3);

    suggested = await service.suggestField(Person, 'name', 'b', {
      where: {
        address: {
          street2: {
            $exists: true
          }
        }
      }
    });
    assert(suggested.length === 1);
  }



  @Test('Verify partial update with field removal')
  async testPartialUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const o = await service.save(Person, Person.from({
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
      address: {
        street1: 'changed',
        street2: undefined
      }
    }));

    const o3 = await service.getById(Person, o.id!);

    assert(o3.name === 'oscar');
    assert(o3.age === 20);
    assert(o3.address.street1 === 'changed');
    assert(!('street2' in o3.address));
  }

  @Test('Verify partial update with field removal and lists')
  async testPartialUpdateList() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const o = await service.save(SimpleList, SimpleList.from({
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
    assert(o2.simples === [Simple.from({ name: 'd' })]);
  }
}