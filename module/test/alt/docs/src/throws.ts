import * as assert from 'assert';

import { Suite } from '../../../src/decorator/suite';
import { Test } from '../../../src/decorator/test';

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