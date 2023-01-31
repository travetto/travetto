import { RootRegistry, MethodSource } from '@travetto/registry';
import { WorkPool, IterableWorkSet, ManualAsyncIterator } from '@travetto/worker';
import { RootIndex } from '@travetto/manifest';
import { ConsoleManager, defineGlobalEnv, ObjectUtil } from '@travetto/base';
import { DynamicFileLoader } from '@travetto/base/src/internal/file-loader';

import { SuiteRegistry } from '../registry/suite';
import { buildStandardTestManager } from '../worker/standard';
import { TestConsumerRegistry } from '../consumer/registry';
import { CumulativeSummaryConsumer } from '../consumer/types/cumulative';
import { RunEvent } from '../worker/types';

function isRunEvent(ev: unknown): ev is RunEvent {
  return ObjectUtil.isPlainObject(ev) && 'type' in ev && typeof ev.type === 'string' && ev.type === 'run-test';
}

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

    const itr = new ManualAsyncIterator<string>();
    const src = new IterableWorkSet(itr);

    await SuiteRegistry.init();
    SuiteRegistry.listen(RootRegistry);

    const consumer = new CumulativeSummaryConsumer(await TestConsumerRegistry.getInstance(format));
    const pool = new WorkPool(buildStandardTestManager(consumer), {
      idleTimeoutMillis: 120000,
      min: 2,
      max: WorkPool.DEFAULT_SIZE
    });

    new MethodSource(RootRegistry).on(e => {
      const [cls, method] = (e.prev ?? e.curr ?? []);
      if (!cls || RootIndex.getFunctionMetadata(cls)?.abstract) {
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
          file: RootIndex.getFunctionMetadata(cls)?.source
        });
      }
    });

    await RootRegistry.init();

    process.send?.({ type: 'watch-init' });

    process.on('message', ev => {
      if (isRunEvent(ev)) {
        itr.add([ev.file, ev.class, ev.method].filter(x => !!x).join('#'), true);
      }
    });

    // Re-run all tests on file change
    DynamicFileLoader.onLoadEvent(ev => {
      if (ev.action === 'update') {
        itr.add(ev.file);
      }
    });

    if (runAllOnStart) {
      for (const test of await RootIndex.findTest({})) {
        await import(test.output);
        itr.add(test.source);
      }
    }

    await pool.process(src);
  }
}

export async function main(format: string = 'tap', runAllOnStart: string = 'true'): Promise<void> {
  defineGlobalEnv({ test: true, dynamic: true });
  ConsoleManager.setDebugFromEnv();
  await TestWatcher.watch(format, runAllOnStart !== 'false');
}