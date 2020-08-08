import * as assert from 'assert';

import { Suite } from '../../../src/decorator/suite';
import { Test } from '../../../src/decorator/test';

@Suite()
class SimpleTest {

  @Test()
  async testRejects() {
    await assert.rejects(async () => {
      throw new Error();
    });

    await assert.doesNotReject(async () => {
      // eslint-disable-next-line
      let a = 5;
    });
  }
}