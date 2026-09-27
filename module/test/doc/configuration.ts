import assert from 'node:assert';

import { ShouldThrow, SkipTest, Suite, Test, Timeout } from '@travetto/test';

@Suite()
class ConfiguredSuite {
  supportsFeature = false;

  @Test()
  @SkipTest(true)
  async skippedDirectly() {
    assert(false);
  }

  @Test()
  @SkipTest((instance: ConfiguredSuite) => !instance.supportsFeature)
  async skippedViaPredicate() {
    assert(true);
  }

  @Test()
  @Timeout(1000)
  async timedOperation() {
    assert(1 === 1);
  }

  @Test()
  @ShouldThrow(Error)
  async mustThrow() {
    throw new Error('Expected failure');
  }
}
