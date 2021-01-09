import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

@Suite()
class SimpleTest {

  @Test()
  async test() {
    // @ts-expect-error
    assert({ size: 20, address: { state: 'VA' } } === {});
  }
}