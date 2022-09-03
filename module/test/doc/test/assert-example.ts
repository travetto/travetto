import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  @Test()
  async test() {
    assert.deepStrictEqual({ size: 20, address: { state: 'VA' } }, {});
  }
}