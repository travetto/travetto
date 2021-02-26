import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';
import { FsUtil } from '@travetto/boot';
import { TranformerTestUtil } from '../test-support/util';

@Suite()
export class TypesTransformSuite {

  @Test()
  async transformQuestion() {
    const output = await TranformerTestUtil.compile(
      FsUtil.resolveUnix(__dirname, '../doc'),
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