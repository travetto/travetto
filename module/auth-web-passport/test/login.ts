import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';

import { BaseWebSuite } from '@travetto/web/support/test/suite/base.ts';
import { BasicWebDispatcher } from '@travetto/web/support/test/dispatcher.ts';

@Suite()
class PassportLoginSuite extends BaseWebSuite {
  dispatcherType = BasicWebDispatcher;

  @Test()
  async simpleTest() {
    assert(true);
  }
}