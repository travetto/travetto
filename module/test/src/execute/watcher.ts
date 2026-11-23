import { ManifestModuleUtil, path } from '@travetto/manifest';
import { Registry } from '@travetto/registry';
import { AsyncQueue, Runtime, RuntimeIndex, TimeUtil, WatchUtil } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import type { TestDiffInput, TestRun } from '../model/test.ts';
import { buildStandardTestManager } from '../worker/standard.ts';
import { isTestRunEvent, type TestReadyEvent } from '../worker/types.ts';
import { TestImpactGraph } from './impact.ts';
import { RunUtil } from './run.ts';

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

    const impactGraph = new TestImpactGraph();
    await impactGraph.init();

    const events: (TestRun | TestDiffInput)[] = [];

    if (runAllOnStart) {
      events.push(...(await RunUtil.resolveGlobInput({ globs: [] })));
    }

    const queue = new AsyncQueue(events);
    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistryIndex.getInstance({ consumer: format }));

    process.on('message', event => {
      if (isTestRunEvent(event)) {
        if (event.type === 'runTests') {
          const ordered = [...event.imports].sort((a, b) => consumer.getFailureRank(b) - consumer.getFailureRank(a));
          for (const imp of ordered) {
            queue.add({ import: imp }, true);
          }
        } else {
          queue.add(event, true);
        }
      }
    });

    process.send?.({ type: 'ready' } satisfies TestReadyEvent);

    const queueProcessor = WorkPool.run(buildStandardTestManager.bind(null, consumer), queue, {
      idleTimeoutMillis: TimeUtil.duration('2m', 'ms'),
      min: 2,
      max: WorkPool.DEFAULT_SIZE
    });

    await WatchUtil.watchCompilerEvents('change', async event => {
      const fileType = ManifestModuleUtil.getFileType(event.file);
      if (fileType !== 'ts' && fileType !== 'js') {
        return;
      }

      const entry = RuntimeIndex.getFromImport(event.import);
      const sourceFile = entry?.sourceFile ?? path.resolve(Runtime.workspace.path, event.file);

      if (event.action === 'delete') {
        const impacted = impactGraph
          .getImpactedTests(sourceFile)
          .sort((a, b) => a.depth - b.depth || consumer.getFailureRank(b.import) - consumer.getFailureRank(a.import));
        impactGraph.removeFile(sourceFile);
        if (entry?.role === 'test') {
          consumer.removeTest(event.import);
        }
        for (const testEntry of impacted) {
          if (testEntry.import !== event.import) {
            queue.add({ import: testEntry.import }, true);
          }
        }
      } else {
        await impactGraph.updateFile(sourceFile);
        const impacted = impactGraph
          .getImpactedTests(sourceFile)
          .sort((a, b) => a.depth - b.depth || consumer.getFailureRank(b.import) - consumer.getFailureRank(a.import));
        if (impacted.length > 0) {
          for (const testEntry of impacted) {
            queue.add(
              testEntry.sourceFile === sourceFile
                ? { import: testEntry.import, diffSource: consumer.produceDiffSource(testEntry.import) }
                : { import: testEntry.import },
              true
            );
          }
        } else if (entry?.role === 'test' || event.file.includes('/test/')) {
          queue.add({ import: event.import, diffSource: consumer.produceDiffSource(event.import) }, true);
        }
      }
    });

    // Cleanup
    await queueProcessor;
  }
}
