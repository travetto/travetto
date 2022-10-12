import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { TransformerTestUtil } from '../test-support/util';
import { SystemUtil } from '../src/util';

@Suite()
export class TypesTransformSuite {

  @Test({ timeout: 10000 })
  async transformQuestion() {
    const output = await TransformerTestUtil.compile(
      SystemUtil.resolveUnix(__dirname, '../doc'),
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