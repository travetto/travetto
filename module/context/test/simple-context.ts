import { Inject, Injectable, DependencyRegistry } from '@travetto/di';
import { Suite, Test, BeforeAll, AfterAll } from '@travetto/test';
import { Context, WithContext } from '../index';
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
    this.context.set('user', 'bob');
    await new Promise(resolve => setTimeout(resolve, 1));
    assert(this.context.get('user') === 'bob');
  }

  @Test()
  @WithContext({})
  async nextContext() {
    console.log(this.context.threads.size);
    assert(this.context.get('user') === undefined);
  }
}