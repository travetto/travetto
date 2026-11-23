import type { CompilerChangeEvent } from '@travetto/compiler';
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

type WatchContext = {
  queue: AsyncQueue<TestRun | TestDiffInput>;
  consumer: CumulativeSummaryConsumer;
  impactGraph: TestImpactGraph;
};

/**
 * Test Watcher.
 *
 * Runs all tests on startup, and then listens for changes to run tests again
 */
export class TestWatcher {
  static #queueImpactedTests({ queue, consumer, impactGraph }: WatchContext, sourceFile: string, deletedImport?: string): number {
    const impacted = impactGraph
      .getImpactedTests(sourceFile)
      .sort((a, b) => a.depth - b.depth || consumer.getFailureRank(b.import) - consumer.getFailureRank(a.import));

    for (const testEntry of impacted) {
      if (testEntry.import === deletedImport) {
        continue;
      }
      queue.add(
        testEntry.sourceFile === sourceFile
          ? { import: testEntry.import, diffSource: consumer.produceDiffSource(testEntry.import) }
          : { import: testEntry.import },
        true
      );
    }

    return impacted.length;
  }

  static #onRunTestsEvent({ queue, consumer }: WatchContext, imports: string[]): void {
    const ordered = [...imports].sort((a, b) => consumer.getFailureRank(b) - consumer.getFailureRank(a));
    for (const targetImport of ordered) {
      queue.add({ import: targetImport }, true);
    }
  }

  static #onFileDelete(context: WatchContext, event: CompilerChangeEvent, sourceFile: string, isTest: boolean): void {
    this.#queueImpactedTests(context, sourceFile, event.import);
    context.impactGraph.removeFile(sourceFile);
    if (isTest) {
      context.consumer.removeTest(event.import);
    }
  }

  static async #onFileUpdate(context: WatchContext, event: CompilerChangeEvent, sourceFile: string, isTest: boolean): Promise<void> {
    await context.impactGraph.updateFile(sourceFile);
    const queuedCount = this.#queueImpactedTests(context, sourceFile);
    if (queuedCount === 0 && (isTest || event.file.includes('/test/'))) {
      context.queue.add({ import: event.import, diffSource: context.consumer.produceDiffSource(event.import) }, true);
    }
  }

  static async #onCompilerChange(context: WatchContext, event: CompilerChangeEvent): Promise<void> {
    const fileType = ManifestModuleUtil.getFileType(event.file);
    if (fileType !== 'ts' && fileType !== 'js') {
      return;
    }

    const entry = RuntimeIndex.getFromImport(event.import);
    const sourceFile = entry?.sourceFile ?? path.resolve(Runtime.workspace.path, event.file);
    const isTest = entry?.role === 'test';

    if (event.action === 'delete') {
      this.#onFileDelete(context, event, sourceFile, isTest);
    } else {
      await this.#onFileUpdate(context, event, sourceFile, isTest);
    }
  }

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
    const context: WatchContext = { queue, consumer, impactGraph };

    process.on('message', event => isTestRunEvent(event) && this.#onRunTestsEvent(context, event.imports));
    process.send?.({ type: 'ready' } satisfies TestReadyEvent);

    const queueProcessor = WorkPool.run(buildStandardTestManager.bind(null, consumer), queue, {
      idleTimeoutMillis: TimeUtil.duration('2m', 'ms'),
      min: 2,
      max: WorkPool.DEFAULT_SIZE
    });

    await WatchUtil.watchCompilerEvents('change', event => this.#onCompilerChange(context, event));

    // Cleanup
    await queueProcessor;
  }
}
