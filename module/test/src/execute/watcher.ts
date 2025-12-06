import { ClassChangeSource, Registry } from '@travetto/registry';
import { WorkPool } from '@travetto/worker';
import { AsyncQueue, RuntimeIndex, castTo } from '@travetto/runtime';
import { SchemaRegistryIndex } from '@travetto/schema';

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
      .withFilter(event => event.metadata?.partial !== true || event.type !== 'suite');

    SchemaRegistryIndex.onSchemaChange((changeEvents) => {
      for (const event of changeEvents) {
        if (event.type === 'delete') {
          consumer.removeClass(event.cls.Ⲑid);
        }
      }
      for (const event of changeEvents.filter(item => item.type !== 'delete').flatMap(item => item.methodChanges)) {
        switch (event.type) {
          case 'delete': {
            const test = SuiteRegistryIndex.getTestConfig(event.previous.owner, event.previous.name)!;
            if (test) {
              process.send?.({
                type: 'removeTest',
                methodNames: [test.methodName],
                method: test.methodName,
                classId: test.classId,
                import: test.import,
              } satisfies TestRemovedEvent);
            }
            break;
          }
          case 'update': {
            const test = SuiteRegistryIndex.getTestConfig(event.current.owner, event.current.name)!;
            if (test) {
              const run: TestRun = {
                import: test.import,
                classId: test.classId,
                methodNames: [test.methodName],
                metadata: { partial: true }
              };
              console.log('Triggering', run);
              queue.add(run, true); // Shift to front
              break;
            }
          }
        }
      }
    });

    // If a file is changed, but doesn't emit classes, re-run whole file
    ClassChangeSource.onNonClassChanges(imp => queue.add({ import: imp }));

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