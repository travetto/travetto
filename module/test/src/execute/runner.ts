import path from 'node:path';

import { TimeUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { WorkPool } from '@travetto/worker';

import { buildStandardTestManager } from '../worker/standard';
import { RunnableTestConsumer } from '../consumer/types/runnable';

import { TestExecutor } from './executor';
import { RunnerUtil } from './util';
import { RunState } from './types';

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
  async runFiles(): Promise<boolean> {
    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const imports = await RunnerUtil.getTestImports(this.#state.args);

    console.debug('Running', { imports, patterns: this.#state.args });

    const testCount = await RunnerUtil.getTestCount(this.#state.args);
    await consumer.onStart({ testCount });
    await WorkPool.run(
      buildStandardTestManager.bind(null, consumer),
      imports,
      {
        idleTimeoutMillis: TimeUtil.asMillis(10, 's'),
        min: 1,
        max: this.#state.concurrency,
      });

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run a single file
   */
  async runSingle(): Promise<boolean> {
    let imp = RuntimeIndex.getFromImport(this.#state.args[0])?.import;

    if (!imp) {
      imp = RuntimeIndex.getFromSource(path.resolve(this.#state.args[0]))?.import;
    }

    const entry = RuntimeIndex.getFromImport(imp!)!;
    if (entry.module !== Runtime.main.name) {
      RuntimeIndex.reinitForModule(entry.module);
    }

    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const [, ...args] = this.#state.args;

    await consumer.onStart({});
    await TestExecutor.execute(consumer, imp!, ...args);
    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run(): Promise<boolean | undefined> {
    switch (this.#state.mode) {
      case 'single': return await this.runSingle();
      case 'standard': return await this.runFiles();
    }
  }
}