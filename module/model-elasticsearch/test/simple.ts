import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { Schema, Currency, Integer, Precision, Float, Text } from '@travetto/schema';

import { BaseElasticsearchTest } from './base';
import { ElasticsearchModelSource } from '../src/source';
import { ElasticsearchUtil } from '../src/util';

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
class SimpleNested {
  id: string;
  addresses: Address[];
  random: any;
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
class Numerical {
  @Currency()
  money: number;

  @Integer()
  whole: number;

  @Precision(30, 30)
  big: number;

  @Float()
  floater: number;
}


@Model()
class User2 {
  id?: string;
  address?: Address;
  name: string;
}

@Suite('Simple Save')
class TestSave extends BaseElasticsearchTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);
    assert.ok(source);
    assert(source instanceof ElasticsearchModelSource);
  }

  @Test('verifySchema')
  async verifySchema() {
    const schema = ElasticsearchUtil.generateSourceSchema(Person);
    assert(schema === {
      properties: {
        id: { type: 'keyword' },
        version: { type: 'keyword' },
        type: { type: 'keyword' },
        createdDate: { type: 'date', format: 'date_optional_time' },
        updatedDate: { type: 'date', format: 'date_optional_time' },
        name: { type: 'keyword', fields: { text: { type: 'text' } } },
        age: { type: 'integer' },
        gender: { type: 'keyword' },
        address: {
          type: 'object',
          properties: {
            street1: { type: 'keyword', fields: { text: { type: 'text' } } },
            street2: { type: 'keyword', fields: { text: { type: 'text' } } },
          },
          dynamic: false
        }
      },
      dynamic: false
    });

    const schema2 = ElasticsearchUtil.generateSourceSchema(SimpleNested);
    assert(schema2 === {
      properties: {
        id: { type: 'keyword' },
        addresses: {
          type: 'nested',
          properties: {
            street1: { type: 'keyword', fields: { text: { type: 'text' } } },
            street2: { type: 'keyword', fields: { text: { type: 'text' } } },
          },
          dynamic: false
        },
        random: {
          type: 'object',
          dynamic: true
        }
      },
      dynamic: false
    });
  }

  @Test('Numeric schema')
  async testNumericSchema() {
    const schema3 = ElasticsearchUtil.generateSourceSchema(Numerical);
    assert(schema3.properties.money.type === 'scaled_float');
    assert(schema3.properties.whole.type === 'integer');
    assert(schema3.properties.big.type === 'double');
    assert(schema3.properties.floater.type === 'float');
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);

    const res = await service.bulkProcess(Person,
      [1, 2, 3, 8].map(x => ({
        upsert: Person.from({
          id: `Orange-${x}`,
          name: 'Bob',
          age: 20 + x,
          gender: 'm',
          address: {
            street1: 'a',
            ...(x === 1 ? { street2: 'b' } : {})
          }
        })
      }))
    );

    assert(res.counts.upsert === 4);

    const single = await service.getById(Person, 'Orange-3');
    assert(single !== undefined);
    assert(single.age === 23);

    await assert.rejects(async () => {
      await service.getById(Person, 'Orange-20');
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
    const res = await service.bulkProcess(Person,
      [0, 1, 2, 3, 4, 5].map(x => ({
        upsert: Person.from({
          id: `Orange-${x}`,
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
}
