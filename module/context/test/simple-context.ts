import * as assert from 'assert';
import * as asyncHooks from 'async_hooks';

import { Inject, Injectable, DependencyRegistry } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';

import { AsyncContext, WithAsyncContext } from '../';
import { RootRegistry } from '../../registry';

@Injectable()
class TestService {
  @Inject() context: AsyncContext;

  postConstruct() {
    console.log('Context Found', this.context);
  }
}

@Suite()
class VerifyContext {

  context: AsyncContext;

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    const svc = await DependencyRegistry.getInstance(TestService);
    this.context = svc.context;
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
    console.log(this.context['threads'].size);
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

    assert(this.context.storageState.size === 0);
    assert(this.context['active'] === 0);
    assert(this.context['threads'].size === 0);
  }
}