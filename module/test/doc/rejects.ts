import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

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