import * as os from 'os';

import { RootRegistry, MethodSource, Class } from '@travetto/registry';
import { WorkPool, IterableInputSource, DynamicAsyncIterator } from '@travetto/worker';

import { TestRegistry } from '../registry/registry';
import { buildWorkManager } from '../worker/parent';
import { RunEvent } from '../worker/types';
import { TestConfig, TestResult } from '../model/test';
import { SuiteConfig, SuiteResult } from '../model/suite';
import { ConsumerRegistry } from '../consumer/registry';
import { Consumer } from '../model/consumer';

/**
 * Test Watcher.
 *
 * Runsa ll tests on startup, and then listens for changes to run tests again
 */
export class TestWatcher {

  /**
   * Total state of all tests run so far
   */
  private static state: Record<string, TestResult['status']> = {};

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
   * Sumamrize a given test suite using the new result and the historical
   * state
   */
  static summarizeSuite(test: TestResult): SuiteResult {
    require(test.file);

    this.state[`${test.classId}!${test.methodName}`] = test.status;
    const SuiteCls = TestRegistry.getClasses().find(x =>
      x.__id === test.classId
    )!;

    const suite = TestRegistry.get(SuiteCls);
    const total = suite.tests.reduce((acc, x) => {
      const status = this.state[`${x.classId}!${x.methodName}`] ?? 'unknown';
      acc[status] += 1;
      return acc;
    }, { skipped: 0, passed: 0, failed: 0, unknown: 0 });

    return {
      classId: suite.classId,
      passed: total.passed,
      failed: total.failed,
      skipped: total.skipped,
      file: suite.file,
      lines: suite.lines,
      total: total.failed + total.passed,
      tests: [],
      duration: 0
    };
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

    const ConsumerCls = ConsumerRegistry.get(format)!;
    const hidden = new ConsumerCls();

    const consumer: Consumer = {
      onEvent: (e) => {
        hidden.onEvent(e);
        try {
          if (e.type === 'test' && e.phase === 'after') {
            const suite = this.summarizeSuite(e.test);
            hidden.onEvent({
              type: 'suite',
              phase: 'after',
              suite
            });
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
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