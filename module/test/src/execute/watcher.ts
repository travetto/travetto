import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, WorkQueue } from '@travetto/worker';
import { Runtime, describeFunction } from '@travetto/runtime';

import { SuiteRegistry } from '../registry/suite';
import { buildStandardTestManager } from '../worker/standard';
import { TestConsumerRegistry } from '../consumer/registry';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative';
import { RunRequest } from '../worker/types';
import { RunnerUtil } from './util';
import { TestEvent } from '../model/event';

function isRunRequest(ev: unknown): ev is RunRequest {
  return typeof ev === 'object' && !!ev && 'type' in ev && typeof ev.type === 'string' && ev.type === 'run-test';
}

type RemoveTestEvent = { type: 'removeTest', method: string, import: string, classId: string };

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

    const itr = new WorkQueue<string | RunRequest>();

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);

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
          const key = { import: conf.import, class: conf.class.name, method: conf.methodName };
          itr.add(key, true); // Shift to front
        }
      } else {
        process.send?.({
          type: 'removeTest',
          method: method?.name,
          classId: cls?.Ⲑid,
          import: Runtime.getImport(cls)
        } satisfies RemoveTestEvent);
      }
    });

    // If a file is changed, but doesn't emit classes, re-run whole file
    RootRegistry.onNonClassChanges(imp => itr.add(imp));

    await RootRegistry.init();

    process.on('message', ev => {
      if (isRunRequest(ev)) {
        console.debug('Manually triggered', ev);
        itr.add(ev, true);
      }
    });

    process.send?.({ type: 'ready' });

    if (runAllOnStart) {
      for await (const imp of await RunnerUtil.getTestImports()) {
        await Runtime.importFrom(imp);
        itr.add(imp);
      }
    }

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