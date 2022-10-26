import { PhaseManager, Util } from '@travetto/base';
import { WorkPool, IterableWorkSet } from '@travetto/worker';

import { TestExecutor } from './executor';
import { buildStandardTestManager } from '../worker/standard';

import { RunnerUtil } from './util';
import { RunState } from './types';
import { RunnableTestConsumer } from '../consumer/types/runnable';

/**
 * Test Runner
 */
export class Runner {

  #state: RunState;

  constructor(state: RunState) {
    this.#state = state;
  }

  get patterns(): RegExp[] {
    return this.#state.args.map(x => new RegExp(x.__posix));
  }

  /**
   * Run all files
   */
  async runFiles(): Promise<boolean> {
    const consumer = RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);

    const files = (await RunnerUtil.getTestFiles(this.patterns));

    console.debug('Running', { files });

    await PhaseManager.run('test');

    const manager = buildStandardTestManager;

    const pool = new WorkPool(manager(consumer), {
      idleTimeoutMillis: Util.timeToMs('10s'),
      min: 1,
      max: this.#state.concurrency
    });

    consumer.onStart();

    await pool
      .process(new IterableWorkSet(files))
      .finally(() => pool.shutdown());

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run a single file
   */
  async runSingle(): Promise<boolean> {
    const consumer = RunnableTestConsumer.get(this.#state.consumer ?? this.#state.format);
    consumer.onStart();

    const [file, ...args] = this.#state.args;

    await PhaseManager.run('test');
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