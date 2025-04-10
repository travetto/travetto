import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { StandardWebRouter } from '@travetto/web';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';

@Suite()
class PassportLoginSuite extends BaseWebSuite {
  dispatcherType = StandardWebRouter;

  @Test()
  async simpleTest() {
    assert(true);
  }
}