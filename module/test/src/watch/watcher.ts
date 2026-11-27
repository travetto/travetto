import { Registry } from '@travetto/registry';
import { AsyncQueue, TimeUtil, WatchUtil } from '@travetto/runtime';
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
    const impact = new TestImpactGraph(consumer, undefined, durations);

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
      queue.add(await impact.onCompilerChange(event), true);
    });

    // Cleanup
    await queueProcessor;
  }
}
