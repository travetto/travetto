import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, IterableWorkSet, ManualAsyncIterator } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';

import { SuiteRegistry } from '../registry/suite';
import { buildStandardTestManager } from '../worker/standard';
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

    const itr = new ManualAsyncIterator<string>();
    const src = new IterableWorkSet(itr);

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);

    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistry.getInstance(format));
    const pool = new WorkPool(buildStandardTestManager(consumer), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: WorkPool.DEFAULT_SIZE
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
          itr.add(`${conf.file}#${conf.class.name}#${conf.methodName}`, true); // Shift to front
        }
      } else if (process.send) {
        process.send({
          type: 'removeTest',
          method: method?.name,
          classId: cls?.Ⲑid,
          file: RootIndex.getFunctionMetadata(cls)?.source
        });
      }
    });

    await RootRegistry.init();
    await pool.process(src);
  }
}