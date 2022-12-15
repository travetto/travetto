import assert from 'assert';
import * as asyncHooks from 'async_hooks';

import { BeforeEach, Suite, Test } from '@travetto/test';
import { TimeUtil } from '@travetto/base';

import { AsyncContext, WithAsyncContext } from '../';

@Suite()
class VerifyContext {

  context: AsyncContext;

  @BeforeEach()
  beforeEach() {
    this.context = new AsyncContext();
  }

  @Test()
  @WithAsyncContext({})
  async loadContext() {
    assert(this.context !== null);
    this.context.set({ user: 'bob' });
    await TimeUtil.wait(1);
    assert(this.context.get().user === 'bob');
  }

  @Test()
  @WithAsyncContext({})
  async nextContext() {
    assert(this.context.get().name === undefined);
  }

  @Test()
  async multipleContext() {
    const attempts = ' '.repeat(10).split('').map((__, i) =>
      async () => {
        const start = asyncHooks.executionAsyncId();
        this.context.set({ name: `test-${i}` });
        await TimeUtil.wait(1);
        const end = asyncHooks.executionAsyncId();

        if (this.context.get().name !== `test-${i}`) {
          throw new Error(`Didn\'t match: ${start} - ${end}`);
        }
      }
    );

    assert(attempts.length === 10);

    await Promise.all(attempts.map(x => this.context.run(x)));
  }

  @Test()
  async concurrentDivergent() {

    const contexts: unknown[] = [];

    await Promise.all([1, 2].map(async (__, i) => {
      await this.context.run(async () => {
        this.context.get().name = `test-${i}`;
        if (i === 1) {
          this.context.get().age = 30;
        }
        await TimeUtil.wait(20);
        await this.context.run(async () => {
          contexts.push(structuredClone(this.context.get()));
        }, { color: 'green' });
      }, { age: 20, name: 'bob' });
    }));

    assert.deepStrictEqual(contexts[0], { age: 20, name: 'test-0', color: 'green' });
    assert.deepStrictEqual(contexts[1], { age: 30, name: 'test-1', color: 'green' });
  }
}