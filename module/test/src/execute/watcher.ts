import { Registry } from '@travetto/registry';
import { WorkPool } from '@travetto/worker';
import { AsyncQueue, RuntimeIndex, castTo, watchCompiler } from '@travetto/runtime';
import { ManifestModuleUtil } from '@travetto/manifest';

import { buildStandardTestManager } from '../worker/standard.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { TestDiffInput, TestRun } from '../model/test.ts';
import { RunUtil } from './run.ts';
import { TestReadyEvent } from '../worker/types.ts';

const VALID_FILE_TYPES = new Set(['js', 'ts']);

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
    )
      .withFilter(event => event.metadata?.partial !== true || event.type !== 'suite');

    // Fire off, and let it run in the bg. Restart on exit
    for await (const event of watchCompiler({ restartOnExit: true })) {
      if (event.file && RuntimeIndex.hasModule(event.module) && VALID_FILE_TYPES.has(ManifestModuleUtil.getFileType(event.file))) {
        switch (event.action) {
          case 'create':
          case 'update': {
            const run: TestDiffInput = {
              import: event.import,
              diffSource: consumer.produceDiffSource(event.import),
              metadata: { partial: true }
            };
            console.log('Triggering', event.file);
            queue.add(run, true); // Shift to front
            break;
          }
          case 'delete': {
            consumer.removeTest(event.import);
            break;
          }
        }
      }
    }

    process.on('message', event => {
      if (typeof event === 'object' && event && 'type' in event && event.type === 'run-test') {
        console.log('Received message', event);
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