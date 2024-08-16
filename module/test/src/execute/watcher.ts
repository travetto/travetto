import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, WorkQueue } from '@travetto/worker';
import { Runtime, RuntimeIndex, castTo, describeFunction } from '@travetto/runtime';

import { SuiteRegistry } from '../registry/suite';
import { buildStandardTestManager } from '../worker/standard';
import { TestConsumerRegistry } from '../consumer/registry';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative';
import { TestRun } from '../worker/types';
import { RunnerUtil } from './util';
import { TestEvent } from '../model/event';

type RemoveTestEvent = { type: 'removeTest' } & TestRun;

export type TestWatchEvent =
  TestEvent |
  RemoveTestEvent |
  { type: 'ready' } |
  { type: 'log', message: string };

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
    await RootRegistry.init();

    const events: TestRun[] = [];

    if (runAllOnStart) {
      const tests = await RunnerUtil.getTestDigest();
      events.push(...RunnerUtil.getTestRuns(tests));
    }

    const itr = new WorkQueue<TestRun>(events);
    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistry.getInstance(format));

    new MethodSource(RootRegistry).on(e => {
      const [cls, method] = (e.prev ?? e.curr ?? []);
      if (!cls || describeFunction(cls).abstract) {
        return;
      }
      if (!method) {
        consumer.removeClass(cls.Ⲑid);
        return;
      }
      const conf = SuiteRegistry.getByClassAndMethod(cls, method)!;
      if (e.type !== 'removing') {
        if (conf) {
          const run: TestRun = { import: conf.import, classId: conf.classId, methodNames: [conf.methodName] };
          console.log('Triggering', run);
          itr.add(run, true); // Shift to front
        }
      } else {
        process.send?.({
          type: 'removeTest',
          methodNames: method?.name ? [method.name!] : undefined!,
          method: method?.name,
          classId: cls?.Ⲑid,
          import: Runtime.getImport(cls)
        } satisfies RemoveTestEvent & { method?: string });
      }
    });


    // If a file is changed, but doesn't emit classes, re-run whole file
    RootRegistry.onNonClassChanges(imp => itr.add({ import: imp }));

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

    process.send?.({ type: 'ready' });

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