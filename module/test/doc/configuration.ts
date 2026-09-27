import assert from 'node:assert';

import { ShouldThrow, SkipIf, SkipIfNot, Suite, Test, Timeout } from '@travetto/test';

@Suite()
class ConfiguredSuite {
  supportsFeature = false;

  @Test()
  @SkipIf(() => true)
  async skippedDirectly() {
    assert(false);
  }

  @Test()
  @SkipIfNot((instance: ConfiguredSuite) => instance.supportsFeature)
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
