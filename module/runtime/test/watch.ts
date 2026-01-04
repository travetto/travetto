import assert from 'node:assert';
import { Suite, Test } from '@travetto/test';

@Suite()
class WatchSuite {
  @Test()
  async testSimple() {
    assert(true);
  }
}