import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { PathUtil } from '@travetto/boot';

import { TranformerTestUtil } from '../test-support/util';

@Suite()
export class TypesTransformSuite {

  @Test({ timeout: 10000 })
  async transformQuestion() {
    const output = await TranformerTestUtil.compile(
      PathUtil.resolveUnix(__dirname, '../doc'),
      'upper.ts'
    );
    assert(output.includes('this.AGE'));
    assert(!output.includes('this.age'));

    assert(output.includes('TEST'));
    assert(!output.includes('Test'));

    assert(output.includes('COMPUTEAGE'));
    assert(!output.includes('computeAge'));
  }
}