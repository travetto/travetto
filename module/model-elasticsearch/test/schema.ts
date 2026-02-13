import assert from 'node:assert';
import type * as  estypes from '@elastic/elasticsearch/api/types';

import { Registry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Model } from '@travetto/model';
import { Currency, Integer, Precision, Float, Text, Schema } from '@travetto/schema';

import { ElasticsearchSchemaUtil } from '@travetto/model-elasticsearch/src/internal/schema.ts';

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
    await Registry.init();
  }

  @Test('verifySchema')
  async verifySchema() {
    const schema = ElasticsearchSchemaUtil.generateSchemaMapping(Person);
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

    const schema2 = ElasticsearchSchemaUtil.generateSchemaMapping(SimpleNested);
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
    const schema3 = ElasticsearchSchemaUtil.generateSchemaMapping(Numerical);

    assert(schema3.properties);
    assert(schema3.properties.money.type === 'scaled_float');
    assert(schema3.properties.whole.type === 'integer');
    assert(schema3.properties.big.type === 'double');
    assert(schema3.properties.floater.type === 'float');
  }

  @Test('should detect type changes in root fields')
  async testRootTypeChange() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        age: { type: 'integer' },
        name: { type: 'keyword' }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        age: { type: 'long' }, // Changed from integer to long
        name: { type: 'keyword' }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['age']);
  }

  @Test('should detect added fields')
  async testAddedFields() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' },
        age: { type: 'integer' }, // New field
        email: { type: 'keyword' } // New field
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.strictEqual(changed.length, 2);
    assert(changed.includes('age'));
    assert(changed.includes('email'));
  }

  @Test('should detect removed fields')
  async testRemovedFields() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' },
        age: { type: 'integer' },
        email: { type: 'keyword' }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.strictEqual(changed.length, 2);
    assert(changed.includes('age'));
    assert(changed.includes('email'));
  }

  @Test('should return empty array when schemas match')
  async testNoChanges() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' },
        age: { type: 'integer' }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' },
        age: { type: 'integer' }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, []);
  }

  @Test('should detect nested object type changes')
  async testNestedTypeChange() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'keyword' }
          }
        }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        address: {
          type: 'nested', // Changed from object to nested
          properties: { street: { type: 'keyword' } }
        }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['address']);
  }

  @Test('should detect changes in nested object properties with correct path')
  async testNestedPropertyChanges() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'keyword' },
            city: { type: 'keyword' },
            zip: { type: 'keyword' }
          }
        }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'text' }, // Type changed
            city: { type: 'keyword' },
            country: { type: 'keyword' } // Added field, zip removed
          }
        }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['address.street', 'address.zip', 'address.country']);
  }

  @Test('should handle mixed root and nested changes')
  async testMixedChanges() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'keyword' }
          }
        }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'text' }, // Root change
        name: { type: 'keyword' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'text' } // Nested change
          }
        }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['id', 'address.street']);
  }

  @Test('should handle missing properties in current')
  async testMissingCurrentProperties() {
    const current: estypes.MappingTypeMapping = { dynamic: false };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['id', 'name']);
  }

  @Test('should handle missing properties in needed')
  async testMissingNeededProperties() {
    const current: estypes.MappingTypeMapping = {
      properties: {
        id: { type: 'keyword' },
        name: { type: 'keyword' }
      },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = { dynamic: false };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['id', 'name']);
  }

  @Test('should handle nested object without properties in current')
  async testNestedWithoutPropertiesInCurrent() {
    const current: estypes.MappingTypeMapping = {
      properties: { address: { type: 'object' } },
      dynamic: false
    };

    const needed: estypes.MappingTypeMapping = {
      properties: {
        address: {
          type: 'object',
          properties: {
            street: { type: 'keyword' }
          }
        }
      },
      dynamic: false
    };

    const changed = ElasticsearchSchemaUtil.getChangedFields(current, needed);
    assert.deepStrictEqual(changed, ['address.street']);
  }
}