import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';

import { Schema, SchemaRegistry } from '..';
import { SchemaValidator } from '../src/validate/validator';

@Schema()
export class OptionalAsUnion {
  name: string;
  alias: string | undefined;
}

@Suite()
class EdgeCases {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
  }

  @Test()
  async testOptionalUnion() {
    const data = OptionalAsUnion.from({
      name: 'bob',
      alias: 'bob'
    });

    assert((await SchemaValidator.validate(data)).alias === 'bob');

    const data2 = OptionalAsUnion.from({
      name: undefined,
      alias: 'bob'
    });

    await assert.rejects(() => SchemaValidator.validate(data2));

    const data3 = OptionalAsUnion.from({
      name: 'bob',
      alias: undefined
    });

    assert((await SchemaValidator.validate(data3)).alias === undefined);

    const data4 = OptionalAsUnion.from({
      name: 'bob'
    });

    assert((await SchemaValidator.validate(data4)).alias === undefined);
  }
}