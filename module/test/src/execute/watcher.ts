import { ManifestModuleUtil } from '@travetto/manifest';
import { Registry } from '@travetto/registry';
import { WorkPool } from '@travetto/worker';
import { AsyncQueue, TimeUtil, WatchUtil } from '@travetto/runtime';

import { buildStandardTestManager } from '../worker/standard.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';
import { RunUtil } from './run.ts';
import { isTestRunEvent, type TestReadyEvent } from '../worker/types.ts';

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

    if (runAllOnStart) {
      events.push(...await RunUtil.resolveGlobInput({ globs: [] }));
    }

    const queue = new AsyncQueue(events);
    const consumer = new CumulativeSummaryConsumer(
      await TestConsumerRegistryIndex.getInstance({ consumer: format })
    );

    process.on('message', event => {
      if (isTestRunEvent(event)) {
        queue.add(event, true);
      }
    });

    process.send?.({ type: 'ready' } satisfies TestReadyEvent);

    const queueProcessor = WorkPool.run(
      buildStandardTestManager.bind(null, consumer),
      queue,
      {
        idleTimeoutMillis: TimeUtil.asMillis('2m'),
        min: 2,
        max: WorkPool.DEFAULT_SIZE
      }
    );

    await WatchUtil.watchCompilerEvents('change', event => {
      const fileType = ManifestModuleUtil.getFileType(event.file);
      if ((fileType === 'ts' || fileType === 'js')) {
        if (event.action === 'delete') {
          consumer.removeTest(event.import);
        } else {
          const diffSource = consumer.produceDiffSource(event.import);
          queue.add({ import: event.import, diffSource }, true);
        }
      }
    });

    // Cleanup
    await queueProcessor;
  }
}