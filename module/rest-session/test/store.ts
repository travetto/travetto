import * as assert from 'assert';

import { Suite, Test, BeforeEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { Env } from '@travetto/boot';

import { MemoryStore } from '../src/store/memory';

@Suite()
export class StoreTest {

  @BeforeEach()
  async init() {
    await DependencyRegistry.init();
  }

  @Test()
  async testMemoryStore() {
    const instance = await DependencyRegistry.getInstance(MemoryStore);

    const now = Date.now();
    const session = await instance.create({ user: 'tom' }, 100);
    assert.ok(session.id);
    assert(session.issuedAt + 1000 > Date.now());

    assert(session.expiresAt! > (now + 90));

    session.refresh();

    assert(session.isTimeChanged());

    session.expiresAt = now + 10;

    assert(session.isAlmostExpired());
  }

  @Test()
  async testFailure() {
    try {
      Env.prod = !(Env.dev = !Env.dev);
      await assert.rejects(async () => new MemoryStore().postConstruct(), 'not intended for production');
    } finally {
      Env.prod = !(Env.dev = !Env.dev);
    }
  }
}