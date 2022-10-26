import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { TimeUtil } from '@travetto/base';

import { ApplicationRegistry } from '../src/registry';
import { Application } from '../src/decorator';

@Application('test')
class TestApp {
  async run(age: number, optional?: 'a' | 'b') {
    console.log('Running', { age, optional });
  }
}

@Application('closeable')
class CloseableApp {
  running = false;

  close() {
    this.running = false;
  }

  async wait() {
    while (this.running) {
      await TimeUtil.wait(50);
    }
  }

  run(age: number, optional?: 'a' | 'b') {
    this.running = true;
  }
}

@Suite()
export class RegistryTest {

  @BeforeAll()
  async beforeAll() {
    await RootRegistry.init();
  }

  @Test()
  async runApp() {
    await assert.rejects(() => ApplicationRegistry.run('test', []));
    await assert.rejects(() => ApplicationRegistry.run('test', ['a']));
    await assert.rejects(() => ApplicationRegistry.run('test', ['20', 'c']));
    await assert.doesNotReject(() => ApplicationRegistry.run('test', ['20']));
    await assert.doesNotReject(() => ApplicationRegistry.run('test', ['20', 'a']));
  }

  @Test()
  async closeable() {
    const app = await DependencyRegistry.getInstance(CloseableApp);
    let done = false;
    const all = ApplicationRegistry.run('closeable', ['20']).then(() => done = true);
    await TimeUtil.wait(50);
    assert(!done);
    assert(app.running === true);
    await app.close();
    await all;
    assert(done);
    // @ts-ignore
    assert(app.running === false);
  }
}