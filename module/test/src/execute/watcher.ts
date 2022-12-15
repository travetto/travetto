import * as os from 'os';

import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, IterableWorkSet, ManualAsyncIterator } from '@travetto/worker';

import { SuiteRegistry } from '../registry/suite';
import { buildStandardTestManager } from '../worker/standard';
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
  static async watch(format: string): Promise<void> {
    console.debug('Listening for changes');

    const itr = new ManualAsyncIterator<RunEvent>();
    const src = new IterableWorkSet(itr);

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);

    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistry.getInstance(format));
    const pool = new WorkPool(buildStandardTestManager(consumer), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: os.cpus.length - 1
    });

    new MethodSource(RootRegistry).on(e => {
      const [cls, method] = (e.prev ?? e.curr ?? []);
      if (!cls) {
        return;
      }
      if (!method) {
        consumer.removeClass(cls.Ⲑid);
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
          classId: cls?.Ⲑid,
          file: cls?.Ⲑsource,
        });
      }
    });

    await RootRegistry.init();

    await pool.process(src)
      .finally(() => pool.shutdown());
  }
}