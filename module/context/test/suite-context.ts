import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite';

import { WithAsyncContext } from '../src/decorator';
import { AsyncContext } from '../src/service';
import { WithSuiteContext } from '../support/test/context';

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
    assert(this.context.get('age') === 20);
  }

  @Test()
  @WithAsyncContext({})
  async basicProp() {
    assert(this.context !== null);
    const prop = this.context.prop('age');
    assert(prop.get() === 20);
  }

  @Test()
  @WithAsyncContext({ age: 30 })
  async override() {
    assert(this.context.get('age') === 30);
  }

  @Test()
  @WithAsyncContext({ age: 30 })
  async overrideProp() {
    assert(this.context !== null);
    const prop = this.context.prop('age');
    assert(prop.get() === 30);
  }
}