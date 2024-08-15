import path from 'node:path';

import { TimeUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import { buildStandardTestManager } from '../worker/standard';
import { RunnableTestConsumer } from '../consumer/types/runnable';

import { TestExecutor } from './executor';
import { RunnerUtil } from './util';
import { RunState } from './types';
import { TestConfig } from '../model/test';
import { TestRun } from '../worker/types';

/**
 * Test Runner
 */
export class Runner {

  #state: RunState;

  constructor(state: RunState) {
    this.#state = state;
  }

  /**
   * Run all files
   */
  async runFiles(globs?: string[]): Promise<boolean> {
    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    console.debug('Running', { globs });

    const tests = await RunnerUtil.getTestDigest(globs, this.#state.tags);
    const testRuns = RunnerUtil.getTestRuns(tests);

    await consumer.onStart({ testCount: tests.length });
    await WorkPool.run(
      f => buildStandardTestManager(consumer, f),
      testRuns,
      {
        idleTimeoutMillis: TimeUtil.asMillis(10, 's'),
        min: 1,
        max: this.#state.concurrency
      });

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run a single file
   */
  async runSingle(run: TestRun): Promise<boolean> {
    const imp =
      RuntimeIndex.getFromImport(run.import)?.import ??
      RuntimeIndex.getFromSource(path.resolve(run.import))?.import!;

    const entry = RuntimeIndex.getFromImport(imp)!;

    if (entry.module !== Runtime.main.name) {
      RuntimeIndex.reinitForModule(entry.module);
    }

    let filter = (_: TestConfig): boolean => true;
    if (run.methodNames?.length) {
      filter = (cfg): boolean => run.methodNames!.includes(cfg.methodName);
    }

    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);
    await consumer.onStart({});
    await new TestExecutor(consumer, filter, false).execute(imp, run.classId, run.methodNames);
    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run(): Promise<boolean | undefined> {
    if ('import' in this.#state.target) {
      return await this.runSingle(this.#state.target);
    } else {
      return await this.runFiles(this.#state.target.globs);
    }
  }
}