import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {
  @Test()
  async testRejects() {
    await assert.rejects(async () => {
      throw new Error();
    });

    await assert.doesNotReject(async () => {
      let a = 5;
    });
  }
}
