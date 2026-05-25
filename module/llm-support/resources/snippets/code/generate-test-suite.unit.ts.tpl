import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class ExampleUnitTest {
  @Test()
  basicAssertion() {
    assert.strictEqual(1 + 1, 2);
  }
}
