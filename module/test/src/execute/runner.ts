import path from 'node:path';

import { path as mp, RuntimeIndex } from '@travetto/manifest';
import { TimeUtil, Runtime } from '@travetto/base';
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

    const files = (await RunnerUtil.getTestFiles(this.patterns)).map(f => f.sourceFile);

    console.debug('Running', { files, patterns: this.patterns });

    const testCount = await RunnerUtil.getTestCount(this.#state.args);
    await consumer.onStart({ testCount });
    await WorkPool.run(
      buildStandardTestManager.bind(null, consumer),
      files,
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
    const mod = RuntimeIndex.getEntry(path.resolve(this.#state.args[0]))!;
    if (mod.module !== Runtime.main.name) {
      RuntimeIndex.reinitForModule(mod.module);
    }

    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const [file, ...args] = this.#state.args;

    await consumer.onStart({});
    await TestExecutor.execute(consumer, file, ...args);
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