import * as assert from 'assert';
import * as asyncHooks from 'async_hooks';

import { DependencyRegistry } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { AsyncContext, WithAsyncContext } from '../';

@Suite()
class VerifyContext {

  context: AsyncContext;

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    this.context = await DependencyRegistry.getInstance(AsyncContext);
  }

  @Test()
  @WithAsyncContext({})
  async loadContext() {
    assert(this.context !== null);
    this.context.set({ user: 'bob' });
    await new Promise(resolve => setTimeout(resolve, 1));
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
        await new Promise(resolve => setTimeout(resolve, 1));
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

    const contexts: any[] = [];

    await Promise.all([1, 2].map(async (__, i) => {
      await this.context.run(async () => {
        this.context.get().name = `test-${i}`;
        if (i === 1) {
          this.context.get().age = 30;
        }
        await new Promise(r => setTimeout(r, 20));
        await this.context.run(async () => {
          contexts.push(JSON.parse(JSON.stringify(this.context.get())));
        }, { color: 'green' });
      }, { age: 20, name: 'bob' });
    }));

    assert(contexts[0] === { age: 20, name: 'test-0', color: 'green' });
    assert(contexts[1] === { age: 30, name: 'test-1', color: 'green' });
  }
}