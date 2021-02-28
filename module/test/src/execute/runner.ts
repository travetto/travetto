import { FsUtil } from '@travetto/boot';
import { PhaseManager } from '@travetto/base';
import { WorkPool, IterableInputSource } from '@travetto/worker';

import { TestExecutor } from './executor';
import { buildWorkManager } from '../worker/parent';

import { RunnerUtil } from './util';
import { RunState } from './types';
import { RunnableTestConsumer } from '../consumer/types/runnable';

/**
 * Test Runner
 */
export class Runner {

  constructor(private state: RunState) { }

  get patterns() {
    return this.state.args.map(x => new RegExp(FsUtil.toUnix(x)));
  }

  /**
   * Run all files
   */
  async runFiles() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);

    const files = (await RunnerUtil.getTestFiles(this.patterns));

    console.debug('Running', { files });

    await PhaseManager.run('test');

    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
      idleTimeoutMillis: 10000,
      min: 1,
      max: this.state.concurrency
    });

    consumer.onStart();

    await pool
      .process(new IterableInputSource(files))
      .finally(() => pool.shutdown());

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run a single file
   */
  async runSingle() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);
    consumer.onStart();

    await PhaseManager.run('test');
    await TestExecutor.execute(consumer, this.state.args[0], ...this.state.args.slice(1));

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run() {
    switch (this.state.mode) {
      case 'isolated': // Modules are prepared appropriately
      case 'single': return await this.runSingle();
      case 'standard': return await this.runFiles();
    }
  }
}