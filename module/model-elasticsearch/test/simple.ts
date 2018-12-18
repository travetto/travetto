import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { Schema, Currency, Integer, Precision, Float, Text } from '@travetto/schema';

import { BaseElasticsearchTest } from './base';
import { ModelElasticsearchSource } from '../src/source';
import { ElasticsearchUtil } from '../src/util';

@Schema()
class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model()
class Person extends BaseModel {
  name: string;
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

@Suite('Simple Save')
class TestSave extends BaseElasticsearchTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);

    assert.ok(source);
    assert(source instanceof ModelElasticsearchSource);

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
        name: { type: 'keyword' },
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

    await assert.throws(async () => {
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
}
