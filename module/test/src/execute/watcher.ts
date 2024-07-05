import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, WorkQueue } from '@travetto/worker';
import { RuntimeIndex } from '@travetto/manifest';
import { ObjectUtil } from '@travetto/base';

import { SuiteRegistry } from '../registry/suite';
import { buildStandardTestManager } from '../worker/standard';
import { TestConsumerRegistry } from '../consumer/registry';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative';
import { RunEvent } from '../worker/types';
import { RunnerUtil } from './util';
import { TestEvent } from '../model/event';

function isRunEvent(ev: unknown): ev is RunEvent {
  return ObjectUtil.isPlainObject(ev) && 'type' in ev && typeof ev.type === 'string' && ev.type === 'run-test';
}

export type TestWatchEvent =
  TestEvent |
  { type: 'removeTest', method: string, file: string, classId: string } |
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

    const itr = new WorkQueue<string>();

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);

    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistry.getInstance(format));

    new MethodSource(RootRegistry).on(e => {
      const [cls, method] = (e.prev ?? e.curr ?? []);
      if (!cls || RuntimeIndex.getFunctionMetadata(cls)?.abstract) {
        return;
      }
      if (!method) {
        consumer.removeClass(cls.Ⲑid);
        return;
      }
      const conf = SuiteRegistry.getByClassAndMethod(cls, method)!;
      if (e.type !== 'removing') {
        if (conf) {
          const key = `${conf.file}#${conf.class.name}#${conf.methodName}`;
          itr.add(key, true); // Shift to front
        }
      } else {
        process.send?.({
          type: 'removeTest',
          method: method?.name,
          classId: cls?.Ⲑid,
          file: RuntimeIndex.getFunctionMetadata(cls)?.source
        });
      }
    });

    // If a file is changed, but doesn't emit classes, re-run whole file
    RootRegistry.onNonClassChanges(file => itr.add(file));

    await RootRegistry.init();

    process.on('message', ev => {
      if (isRunEvent(ev)) {
        console.debug('Manually triggered', ev);
        itr.add([ev.file, ev.class, ev.method].filter(x => !!x).join('#'), true);
      }
    });

    process.send?.({ type: 'ready' });

    if (runAllOnStart) {
      for (const test of await RunnerUtil.getTestFiles()) {
        await import(test.import);
        itr.add(test.sourceFile);
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