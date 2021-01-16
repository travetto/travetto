import * as os from 'os';

import { Class } from '@travetto/base';
import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, IterableInputSource, DynamicAsyncIterator } from '@travetto/worker';

import { SuiteRegistry } from '../registry/suite';
import { buildWorkManager } from '../worker/parent';
import { RunEvent } from '../worker/types';
import { TestConsumerRegistry } from '../consumer/registry';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative';

/**
 * Test Watcher.
 *
 * Runs all tests on startup, and then listens for changes to run tests again
 */
export class TestWatcher {

  /**
   * Start watching all test files
   */
  static async watch(format: string) {
    console.debug('Listening for changes');

    const itr = new DynamicAsyncIterator<RunEvent>();
    const src = new IterableInputSource(itr);

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);

    const consumer = new CumulativeSummaryConsumer(TestConsumerRegistry.getInstance(format));
    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: os.cpus.length - 1
    });

    new MethodSource(RootRegistry).on(e => {
      const [cls, method] = (e.prev ?? e.curr ?? []) as [Class, Function];
      if (!method) {
        consumer.removeClass(cls.ᚕid);
        return;
      }
      const conf = SuiteRegistry.getByClassAndMethod(cls, method)!;
      if (e.type !== 'removing') {
        if (conf) {
          itr.add({
            method: conf.methodName,
            file: conf.file,
            class: conf.class.name
          }, true); // Shift to front
        }
      } else if (process.send) {
        process.send({
          type: 'removeTest',
          method: method?.name,
          classId: cls?.ᚕid,
          file: cls?.ᚕfile,
        });
      }
    });

    await RootRegistry.init();

    await pool.process(src)
      .finally(() => pool.shutdown());
  }
}