import path from 'node:path';

import { TimeUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import { buildStandardTestManager } from '../worker/standard.ts';
import { RunnableTestConsumer } from '../consumer/types/runnable.ts';
import { TestRun } from '../model/test.ts';

import { TestExecutor } from './executor.ts';
import { RunnerUtil } from './util.ts';
import { RunState } from './types.ts';
import { TestConsumerRegistryIndex } from '../consumer/registry-index.ts';

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
    const target = await TestConsumerRegistryIndex.getInstance(this.#state);
    const consumer = new RunnableTestConsumer(target);
    const tests = await RunnerUtil.getTestDigest(globs, this.#state.tags);
    const testRuns = RunnerUtil.getTestRuns(tests)
      .toSorted((a, b) => a.runId!.localeCompare(b.runId!));

    await consumer.onStart({ testCount: tests.length });
    await WorkPool.run(
      run => buildStandardTestManager(consumer, run),
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
    run.import =
      RuntimeIndex.getFromImport(run.import)?.import ??
      RuntimeIndex.getFromSource(path.resolve(run.import))?.import!;

    const entry = RuntimeIndex.getFromImport(run.import)!;

    if (entry.module !== Runtime.main.name) {
      RuntimeIndex.reinitForModule(entry.module);
    }

    const target = await TestConsumerRegistryIndex.getInstance(this.#state);

    const consumer = new RunnableTestConsumer(target)
      .withTransformer(event => {
        // Copy run metadata to event
        event.metadata = run.metadata;
        return event;
      });

    await consumer.onStart({});
    await new TestExecutor(consumer).execute(run);
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