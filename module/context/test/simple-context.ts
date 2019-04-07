import * as assert from 'assert';
import * as async_hooks from 'async_hooks';

import { Inject, Injectable, DependencyRegistry } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';

import { Context, WithContext } from '../';

@Injectable()
class TestService {
  @Inject() context: Context;

  postConstruct() {
    console.log('Context Found', this.context);
  }
}

@Suite()
class VerifyContext {

  context: Context;

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
    const svc = await DependencyRegistry.getInstance(TestService);
    this.context = svc.context;
  }

  @Test()
  @WithContext({})
  async loadContext() {
    assert(this.context !== null);
    this.context.set({ user: 'bob' });
    await new Promise(resolve => setTimeout(resolve, 1));
    assert(this.context.get().user === 'bob');
  }

  @Test()
  @WithContext({})
  async nextContext() {
    console.log(this.context['threads'].size);
    assert(this.context.get().name === undefined);
  }

  @Test()
  async multipleContext() {
    const attempts = ' '.repeat(10).split('').map((_, i) => {
      return async () => {
        const start = async_hooks.executionAsyncId();
        this.context.set({ name: `test-${i}` });
        await new Promise(resolve => setTimeout(resolve, 1));
        const end = async_hooks.executionAsyncId();

        if (this.context.get().name !== `test-${i}`) {
          throw new Error(`Didn\'t match: ${start} - ${end}`);
        }
      };
    });

    assert(attempts.length === 10);

    await Promise.all(attempts.map(x => this.context.run(x)));
  }
}