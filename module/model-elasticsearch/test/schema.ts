import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Model } from '@travetto/model';
import { Currency, Integer, Precision, Float, Text, Schema } from '@travetto/schema';

import { ElasticsearchSchemaUtil } from '../src/internal/schema';

@Schema()
class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model()
class Person {
  id: string;
  type?: string;
  createdDate?: Date;
  updatedDate?: Date;
  @Text() name: string;
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Model()
class SimpleNested {
  id: string;
  addresses: Address[];
  random: object;
}

@Model()
class Numerical {
  id: string;

  @Currency()
  money: number;

  @Integer()
  whole: number;

  @Precision(30, 30)
  big: number;

  @Float()
  floater: number;
}

@Suite()
class SchemaSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test('verifySchema')
  async verifySchema() {
    const schema = ElasticsearchSchemaUtil.generateSourceSchema(Person);
    assert.deepStrictEqual(schema, {
      properties: {
        id: { type: 'keyword' },
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

    const schema2 = ElasticsearchSchemaUtil.generateSourceSchema(SimpleNested);
    assert.deepStrictEqual(schema2, {
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
    const schema3 = ElasticsearchSchemaUtil.generateSourceSchema(Numerical);

    assert(schema3.properties.money.type === 'scaled_float');
    assert(schema3.properties.whole.type === 'integer');
    assert(schema3.properties.big.type === 'double');
    assert(schema3.properties.floater.type === 'float');
  }
}