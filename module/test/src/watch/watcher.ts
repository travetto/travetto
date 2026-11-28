import { Registry } from '@travetto/registry';
import { AsyncQueue, RuntimeIndex, TimeUtil, WatchUtil } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { TestDurationCache } from '../execute/duration.ts';
import { RunUtil } from '../execute/run.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';
import { buildStandardTestManager } from '../worker/standard.ts';
import { isTestRunEvent, type TestReadyEvent } from '../worker/types.ts';
import { TestImpactGraph } from './impact.ts';

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

    const events: (TestRun | TestDiffInput)[] = [];

    const durations = await TestDurationCache.load();

    if (runAllOnStart) {
      events.push(...durations.orderRuns(await RunUtil.resolveGlobInput({ globs: [] })));
    }

    const queue = new AsyncQueue(events);
    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistryIndex.getInstance({ consumer: format }));
    consumer.addConsumer(durations);
    const impact = new TestImpactGraph(consumer.isFailing, undefined, durations);

    process.on('message', event => {
      if (isTestRunEvent(event)) {
        queue.add(event, true);
      }
    });

    process.send?.({ type: 'ready' } satisfies TestReadyEvent);

    const queueProcessor = WorkPool.run(buildStandardTestManager.bind(null, consumer), queue, {
      idleTimeoutMillis: TimeUtil.duration('2m', 'ms'),
      min: 2,
      max: WorkPool.DEFAULT_SIZE
    });

    await WatchUtil.watchCompilerEvents('change', async event => {
      if (event.action === 'create' || (event.action === 'update' && !RuntimeIndex.getFromImport(event.import))) {
        RuntimeIndex.reinit();
      }

      queue.add(await impact.onCompilerChange(event), true);

      if (event.action === 'delete') {
        durations.delete(event.import);
        consumer.removeTest(event.import);
        RuntimeIndex.reinit();
      } else if (await RunUtil.isTestFile(event.file)) {
        // Put at the top
        queue.add({ import: event.import, diffSource: consumer.produceDiffSource(event.import) }, true);
      }
    });

    // Cleanup
    await queueProcessor;
  }
}
