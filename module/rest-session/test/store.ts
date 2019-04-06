import * as assert from 'assert';

import { Suite, Test, BeforeEach } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { Env } from '@travetto/base';

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
    assert(session.issuedAt.getTime() + 1000 > Date.now());

    assert(session.expiresAt!.getTime() > (now + 90));

    session.refresh();

    assert(session.isTimeChanged());

    session.expiresAt = new Date(now + 10);

    assert(session.isAlmostExpired());
  }

  @Test()
  async testFailure() {
    try {
      (Env as any).prod = !((Env as any).dev = !(Env as any).dev);
      await assert.rejects(async () => new MemoryStore().postConstruct(), 'not intended for production');
    } finally {
      (Env as any).prod = !((Env as any).dev = !(Env as any).dev);
    }
  }
}