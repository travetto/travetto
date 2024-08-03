import path from 'node:path';

import { path as mp } from '@travetto/manifest';
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

  get patterns(): RegExp[] {
    return this.#state.args.map(x => new RegExp(mp.toPosix(x)));
  }

  /**
   * Run all files
   */
  async runFiles(): Promise<boolean> {
    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const imports = await RunnerUtil.getTestImports(this.patterns);

    console.debug('Running', { imports, patterns: this.patterns });

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
    const entry = RuntimeIndex.getEntry(path.resolve(this.#state.args[0]))!;
    if (entry.module !== Runtime.main.name) {
      RuntimeIndex.reinitForModule(entry.module);
    }

    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const [, ...args] = this.#state.args;

    await consumer.onStart({});
    await TestExecutor.execute(consumer, entry.import, ...args);
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