import * as assert from 'assert';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { Schema } from '..';
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
    await RootRegistry.init();
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
}