import * as os from 'os';

import { RootRegistry, MethodSource, Class } from '@travetto/registry';
import { WorkPool, IterableInputSource, DynamicAsyncIterator } from '@travetto/worker';

import { TestRegistry } from '../registry/registry';
import { buildWorkManager } from '../worker/parent';
import { RunEvent } from '../worker/types';
import { TestConfig } from '../model/test';
import { SuiteConfig } from '../model/suite';
import { TestConsumerRegistry } from '../consumer/registry';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative';

/**
 * Test Watcher.
 *
 * Runsa ll tests on startup, and then listens for changes to run tests again
 */
export class TestWatcher {

  /**
   * Build a test configuration given various inputs
   */
  static getConf(o?: Class): SuiteConfig | undefined;
  static getConf(o?: [Class, Function]): TestConfig | undefined;
  static getConf(o?: [Class, Function] | Class) {
    if (o) {
      if (Array.isArray(o)) {
        const [cls, method] = o;
        if (TestRegistry.has(cls)) {
          const conf = TestRegistry.get(cls);
          if (method) {
            return conf.tests.find(x => x.methodName === method.name);
          } else {
            return conf;
          }
        }
      } else {
        return TestRegistry.get(o);
      }
    }
  }

  /**
   * Start watching all test files
   */
  static async watch(format: string) {
    console.debug('Listening for changes');

    const itr = new DynamicAsyncIterator<RunEvent>();
    const src = new IterableInputSource(itr);

    await TestRegistry.init();
    TestRegistry.listen(RootRegistry);

    const pool = new WorkPool(buildWorkManager.bind(null, new CumulativeSummaryConsumer(
      TestConsumerRegistry.getInstance(format)
    )), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: os.cpus.length - 1
    });

    const methods = new MethodSource(RootRegistry);

    // Wait until after loaded
    methods.on(e => {
      const conf = this.getConf(e.prev ?? e.curr);
      if (!conf) { return; }

      switch (e.type) {
        case 'added': case 'changed': {
          itr.add({
            method: conf.methodName,
            file: conf.file,
            class: conf.class.name
          }, true); // Shift to front
          break;
        }
        case 'removing': {
          /**
           *
           */
        }
      }
    });

    await pool
      .process(src)
      .finally(() => pool.shutdown());
  }
}