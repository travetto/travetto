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
  }
}