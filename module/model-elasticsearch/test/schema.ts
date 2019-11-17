import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { ElasticsearchUtil } from '../src/util';
import { Model, BaseModel } from '@travetto/model';
import { Currency, Integer, Precision, Float, Text, Schema, SchemaRegistry } from '@travetto/schema';
import { ModelRegistry } from '@travetto/model/src/registry';

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

@Suite()
class SchemaSuite {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
    await ModelRegistry.init();
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
}