import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';
import { BasicWebRouter } from '@travetto/web/support/test/test-router.ts';

@Suite()
class PassportLoginSuite extends BaseWebSuite {
  routerType = BasicWebRouter;

  @Test()
  async simpleTest() {
    assert(true);
  }
}