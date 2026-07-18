import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {
  @Test()
  async testThrows() {
    assert.throws(() => {
      throw new Error();
    });

    assert.doesNotThrow(() => {
      let a = 5;
    });
  }
}
