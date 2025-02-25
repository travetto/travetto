import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite.ts';

import { WithAsyncContext } from '../src/decorator.ts';
import { AsyncContext } from '../src/service.ts';
import { WithSuiteContext } from '../support/test/context.ts';
import { AsyncContextValue } from '../src/value.ts';

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