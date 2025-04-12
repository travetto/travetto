import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { LocalRequestDispatcher } from '@travetto/web/support/test/dispatcher.ts';
import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';

@Suite()
class PassportLoginSuite extends BaseWebSuite {
  dispatcherType = LocalRequestDispatcher;

  @Test()
  async simpleTest() {
    assert(true);
  }
}