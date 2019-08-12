import * as assert from 'assert';

import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { Schema, Text } from '@travetto/schema';

import { BaseModelTest } from '../../extension/base.test';
import { Model, ModelService, BaseModel } from '../..';
import { ModelSource } from '../../src/service/source';

@Schema()
class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model()
class Person extends BaseModel {
  @Text() name: string;
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

@Model()
class Bools {
  id?: string;
  value?: boolean;
}

@Suite('Simple Save')
export abstract class BaseSimpleSourceSuite extends BaseModelTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);
    assert.ok(source);

    assert(source instanceof this.sourceClass);
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);

    const people = [1, 2, 3, 8].map(x => Person.from({
      id: service.generateId(),
      name: 'Bob',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    }));

    const res = await service.bulkProcess(Person,
      people.map(p => ({ upsert: p }))
    );

    assert(res.counts.upsert === people.length);

    const single = await service.getById(Person, people[2].id!);
    assert(single !== undefined);
    assert(single.age === 23);

    await assert.rejects(async () => {
      await service.getById(Person, service.generateId());
    }, /Invalid/);

    const match = await service.getAllByQueryString(Person, { query: 'name=="Bob" and age < 24' });

    assert(match.length === 3);

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

    assert(match3.length === 1);
    assert(Object.keys(match3[0]).includes('address'));
    assert(!Object.keys(match3[0]).includes('age'));
    assert(!Object.keys(match3[0].address).includes('street2'));
    assert(Object.keys(match3[0].address) === ['street1']);
    assert(Object.keys(match3[0]).includes('id'));

    const match4 = await service.query(Person, {
      select: {
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

    assert(!Object.keys(match4[0]).includes('id'));
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
    const people = [0, 1, 2, 3, 4, 5].map(x =>
      Person.from({
        id: service.generateId(),
        name: names[x],
        age: 20 + x,
        gender: 'm',
        address: {
          street1: 'a',
          ...(x === 1 ? { street2: 'b' } : {})
        }
      }));

    const res = await service.bulkProcess(Person,
      people.map(x => ({ upsert: x }))
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
      gender: 'f',
      address: {
        street1: 'changed\n',
        street2: undefined
      }
    }));

    const o3 = await service.getById(Person, o.id!);

    assert(o3.name === 'oscar');
    assert(o3.age === 20);
    assert(o3.gender === 'f' as any);
    assert(o3.address.street1 === 'changed\n');
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

  @Test('Verify partial update with field removal and lists')
  async testBlankPartialUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const o = await service.save(User2, User2.from({
      name: 'bob'
    }));

    assert(o.address === undefined);

    await service.updatePartial(User2, User2.from({
      id: o.id,
      address: {
        street1: 'blue'
      }
    }));

    const o3 = await service.getById(User2, o.id!);

    assert(o3.address !== undefined);
    assert(o3.address!.street1 === 'blue');
  }

  @Test('verify dates')
  async testDates() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const res = await service.save(Dated, Dated.from({ time: new Date() }));

    assert(res.time instanceof Date);
  }

  @Test('verify word boundary')
  async testWordBoundary() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const people = [1, 2, 3, 8].map(x => Person.from({
      id: service.generateId(),
      name: 'Bob Ombo',
      age: 20 + x,
      gender: 'm',
      address: {
        street1: 'a',
        ...(x === 1 ? { street2: 'b' } : {})
      }
    }));

    await service.bulkProcess(Person, people.map(p => ({ upsert: p })));

    const results = await service.getAllByQueryString(Person, { query: 'name ~ /\\bomb.*/i' });
    assert(results.length === 4);

    const results2 = await service.getAllByQueryString(Person, { query: 'name ~ /\\bmbo.*/i' });
    assert(results2.length === 0);

    const results3 = await service.getAllByQueryString(Person, { query: 'name ~ /\\bomb.*/' });
    assert(results3.length === 0);
  }

  @Test('verify empty queries')
  async testEmptyCheck() {
    const service = await DependencyRegistry.getInstance(ModelService);
    await service.bulkProcess(Bools, [true, false, null, false, true, undefined, null].map(x => {
      return {
        insert: Bools.from({
          value: x!
        })
      };
    }));

    console.log('Created!');

    const results = await service.getAllByQuery(Bools, {});
    assert(results.length === 7);

    console.log('Got All!');

    const results2 = await service.getAllByQuery(Bools, {
      where: {
        value: {
          $exists: true
        }
      }
    });
    console.log('Searched!');

    assert(results2.length === 4);

    const results3 = await service.getAllByQueryString(Bools, {
      query: 'value != true'
    });
    assert(results3.length === 5);

    const results4 = await service.getAllByQueryString(Bools, {
      query: 'value != false'
    });
    assert(results4.length === 5);
  }
}
