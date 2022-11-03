import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  @Test()
  async testThrows() {
    assert.throws(() => {
      throw new Error();
    });

    assert.doesNotThrow(() => {
      // eslint-disable-next-line
      let a = 5;
    });
  }
}