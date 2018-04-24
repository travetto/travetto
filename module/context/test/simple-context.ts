import { Inject, Injectable, DependencyRegistry } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Context } from '../index';
import { assert } from 'console';

@Injectable()
class TestService {
  @Inject() context: Context;

  postConstruct() {
    console.log('Context Found', this.context);
  }
}

@Suite()
class VerifyContext {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init()
  }

  @Test()
  async loadContext() {
    const svc = await DependencyRegistry.getInstance(TestService)
    assert(svc.context !== null);
    await new Promise(resolve => {
      svc.context.namespace.run(async () => {
        svc.context.set({ user: 'bob' });
        await new Promise(resolve2 => setTimeout(resolve2, 1));
        assert(svc.context.get().user === 'bob');
        resolve();
      })
    })
  }
}