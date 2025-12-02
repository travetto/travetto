import { Registry } from '@travetto/registry';
import { WorkPool } from '@travetto/worker';
import { AsyncQueue, Runtime, RuntimeIndex, castTo, describeFunction } from '@travetto/runtime';

import { buildStandardTestManager } from '../worker/standard.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { TestRun } from '../model/test.ts';
import { RunnerUtil } from './util.ts';
import { TestReadyEvent, TestRemovedEvent } from '../worker/types.ts';
import { SuiteRegistryIndex } from '../registry/registry-index.ts';

/**
 * Test Watcher.
 *
 * Runs all tests on startup, and then listens for changes to run tests again
 */
export class TestWatcher {

  /**
   * Start watching all test files
   */
  static async watch(format: string, runAllOnStart = true): Promise<void> {
    console.debug('Listening for changes');

    await Registry.init();

    const events: TestRun[] = [];

    if (runAllOnStart) {
      const tests = await RunnerUtil.getTestDigest();
      events.push(...RunnerUtil.getTestRuns(tests));
    }

    const queue = new AsyncQueue(events);
    const consumer = new CumulativeSummaryConsumer(
      await TestConsumerRegistryIndex.getInstance({ consumer: format })
    )
      .withFilter(x => x.metadata?.partial !== true || x.type !== 'suite');

    Registry.onMethodChange((event) => {
      const [cls, method] = ('prev' in event && event.prev ? event.prev : null) ??
        ('curr' in event && event.curr ? event.curr : []);

      if (!cls || describeFunction(cls).abstract) {
        return;
      }

      const classId = cls.Ⲑid;
      if (!method) {
        consumer.removeClass(classId);
        return;
      }

      const conf = SuiteRegistryIndex.getTestConfig(cls, method)!;
      if (event.type !== 'removing') {
        if (conf) {
          const run: TestRun = {
            import: conf.import, classId: conf.classId, methodNames: [conf.methodName], metadata: { partial: true }
          };
          console.log('Triggering', run);
          queue.add(run, true); // Shift to front
        }
      } else {
        process.send?.({
          type: 'removeTest',
          methodNames: method?.name ? [method.name!] : undefined!,
          method: method?.name,
          classId,
          import: Runtime.getImport(cls)
        } satisfies TestRemovedEvent);
      }
    }, SuiteRegistryIndex);

    // If a file is changed, but doesn't emit classes, re-run whole file
    Registry.onNonClassChanges(imp => queue.add({ import: imp }));

    process.on('message', event => {
      if (typeof event === 'object' && event && 'type' in event && event.type === 'run-test') {
        console.log('Received message', event);
        // Legacy
        if ('file' in event && typeof event.file === 'string') {
          event = { import: RuntimeIndex.getFromSource(event.file)?.import! };
        }
        console.debug('Manually triggered', event);
        queue.add(castTo(event), true);
      }
    });

    process.send?.({ type: 'ready' } satisfies TestReadyEvent);

    await WorkPool.run(
      buildStandardTestManager.bind(null, consumer),
      queue,
      {
        idleTimeoutMillis: 120000,
        min: 2,
        max: WorkPool.DEFAULT_SIZE
      }
    );
  }
}