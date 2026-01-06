import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { type AsyncContext, AsyncContextValue, WithAsyncContext } from '@travetto/context';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context';

@Suite()
@InjectableSuite()
@WithSuiteContext()
class WithSuiteContextSuite {

  @Inject()
  context: AsyncContext;

  @Test()
  @WithAsyncContext()
  async basic() {
    assert(this.context !== null);
    this.context.set('age', 20);
    assert(this.context.get('age') === 20);
  }

  @Test()
  @WithAsyncContext()
  async basicProp() {
    assert(this.context !== null);
    const prop = new AsyncContextValue(this);
    prop.set(20);
    assert(prop.get() === 20);
  }
}