import { path } from '@travetto/manifest';
import { TimeUtil } from '@travetto/base';
import { WorkPool, IterableWorkSet } from '@travetto/worker';

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
    return this.#state.args.map(x => new RegExp(path.toPosix(x)));
  }

  /**
   * Run all files
   */
  async runFiles(): Promise<boolean> {
    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const files = (await RunnerUtil.getTestFiles(this.patterns));

    console.debug('Running', { files, patterns: this.patterns });

    const manager = buildStandardTestManager;

    const pool = new WorkPool(manager(consumer), {
      idleTimeoutMillis: TimeUtil.timeToMs('10s'),
      min: 1,
      max: this.#state.concurrency
    });

    await consumer.onStart(files);
    await pool.process(new IterableWorkSet(files));
    return consumer.summarizeAsBoolean();
  }

  /**
   * Run a single file
   */
  async runSingle(): Promise<boolean> {
    const consumer = await RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const [file, ...args] = this.#state.args;

    await consumer.onStart([path.resolve(file)]);
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