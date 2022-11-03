import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test.suite';

import { AsyncContext, WithAsyncContext } from '..';
import { WithSuiteContext } from '../support/test.context';

@Suite()
@InjectableSuite()
@WithSuiteContext({ age: 20 })
class WithSuiteContextSuite {

  @Inject()
  context: AsyncContext;

  @Test()
  @WithAsyncContext({})
  async basic() {
    assert(this.context !== null);
    assert(this.context.get().age === 20);
  }

  @Test()
  @WithAsyncContext({ age: 30 })
  async override() {
    assert(this.context.get().age === 30);
  }
}