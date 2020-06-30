import * as assert from 'assert';

import { Suite } from '../../../../src/decorator/suite';
import { Test } from '../../../../src/decorator/test';

@Suite()
class SimpleTest {

  @Test()
  async test() {
    assert({ size: 20, address: { state: 'VA' } } === {});
  }
}