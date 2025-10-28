import { RegistryV2, MethodSource } from '@travetto/registry';
import { WorkPool } from '@travetto/worker';
import { AsyncQueue, Runtime, RuntimeIndex, castTo, describeFunction } from '@travetto/runtime';

import { SuiteRegistry } from '../registry/suite.ts';
import { buildStandardTestManager } from '../worker/standard.ts';
import { TestConsumerRegistry } from '../consumer/registry.ts';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative.ts';
import { TestRun } from '../model/test.ts';
import { RunnerUtil } from './util.ts';
import { TestReadyEvent, TestRemovedEvent } from '../worker/types.ts';

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

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);
    await RegistryV2.init();

    const events: TestRun[] = [];

    if (runAllOnStart) {
      const tests = await RunnerUtil.getTestDigest();
      events.push(...RunnerUtil.getTestRuns(tests));
    }

    const itr = new AsyncQueue(events);
    const consumer = new CumulativeSummaryConsumer(
      await TestConsumerRegistry.getInstance({ consumer: format })
    )
      .withFilter(x => x.metadata?.partial !== true || x.type !== 'suite');

    new MethodSource(RootRegistry).on(e => {
      const [cls, method] = (e.prev ?? e.curr ?? []);
      if (!cls || describeFunction(cls).abstract) {
        return;
      }
      const classId = cls.Ⲑid;
      if (!method) {
        consumer.removeClass(classId);
        return;
      }
      const conf = SuiteRegistry.getByClassAndMethod(cls, method)!;
      if (e.type !== 'removing') {
        if (conf) {
          const run: TestRun = {
            import: conf.import, classId: conf.classId, methodNames: [conf.methodName], metadata: { partial: true }
          };
          console.log('Triggering', run);
          itr.add(run, true); // Shift to front
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
    });

    // If a file is changed, but doesn't emit classes, re-run whole file
    RegistryV2.onNonClassChanges(imp => itr.add({ import: imp }));

    process.on('message', ev => {
      if (typeof ev === 'object' && ev && 'type' in ev && ev.type === 'run-test') {
        console.log('Received message', ev);
        // Legacy
        if ('file' in ev && typeof ev.file === 'string') {
          ev = { import: RuntimeIndex.getFromSource(ev.file)?.import! };
        }
        console.debug('Manually triggered', ev);
        itr.add(castTo(ev), true);
      }
    });

    process.send?.({ type: 'ready' } satisfies TestReadyEvent);

    await WorkPool.run(
      buildStandardTestManager.bind(null, consumer),
      itr,
      {
        idleTimeoutMillis: 120000,
        min: 2,
        max: WorkPool.DEFAULT_SIZE
      }
    );
  }
}