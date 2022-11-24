import assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { TransformerTestUtil } from '../support/test/util';
import { path } from '@travetto/manifest';

@Suite()
export class TypesTransformSuite {

  @Test({ timeout: 10000 })
  async transformQuestion() {
    const output = await TransformerTestUtil.compile(
      path.resolve(__dirname, '../doc'),
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