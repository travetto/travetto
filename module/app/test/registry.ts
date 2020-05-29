import * as assert from 'assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { ApplicationRegistry } from '../src/registry';
import { Application } from '../src/decorator';
import { ApplicationHandle } from '../src/types';

const wait = (n: number) => new Promise(res => setTimeout(res, n));

@Application('test')
class TestApp {
  async run(age: number, optional?: 'a' | 'b') {
    console.log(age, optional);
  }
}

@Application('closeable')
class CloseableApp implements ApplicationHandle {
  running = false;

  async wait() {
    while (this.running) {
      await wait(50);
    }
  }

  async close() {
    this.running = false;
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
    await wait(50);
    assert(!done);
    assert(app.running === true);
    await app.close();
    await all;
    assert(done);
    // @ts-ignore
    assert(app.running === false);
  }
}