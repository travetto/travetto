import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Schema, SchemaRegistryIndex, SchemaValidator } from '@travetto/schema';

@Schema()
export class OptionalAsUnion {
  name: string;
  alias: string | undefined;
}

@Schema()
class WithEmptyObject {
  empty: {} = {};
}

@Schema()
class SingleField {
  single: { field?: 20 } = {};
}

@Suite()
class EdgeCases {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async testOptionalUnion() {
    const data = OptionalAsUnion.from({
      name: 'bob',
      alias: 'bob'
    });

    assert((await SchemaValidator.validate(OptionalAsUnion, data)).alias === 'bob');

    const data2 = OptionalAsUnion.from({
      name: undefined,
      alias: 'bob'
    });

    await assert.rejects(() => SchemaValidator.validate(OptionalAsUnion, data2));

    const data3 = OptionalAsUnion.from({
      name: 'bob',
      alias: undefined
    });

    assert((await SchemaValidator.validate(OptionalAsUnion, data3)).alias === undefined);

    const data4 = OptionalAsUnion.from({
      name: 'bob'
    });

    assert((await SchemaValidator.validate(OptionalAsUnion, data4)).alias === undefined);
  }

  @Test()
  async testEmpty() {
    const fields = SchemaRegistryIndex.getFieldMap(WithEmptyObject);
    assert(fields);
    assert('empty' in fields);
    assert(fields.empty.type === Object);
  }

  @Test()
  async testSingle() {
    const fields = SchemaRegistryIndex.getFieldMap(SingleField);
    assert(fields);
    assert('single' in fields);
    assert(fields.single.type !== Object);
    assert(SchemaRegistryIndex.getFieldMap(fields.single.type).field.type === Number);
  }
}