import { PathUtil } from '@travetto/boot';
import { PhaseManager } from '@travetto/base';
import { WorkPool, IterableInputSource } from '@travetto/worker';

import { TestExecutor } from './executor';
import { buildStandardTestManager } from '../worker/standard';
import { buildIsolatedTestManager } from '../worker/isolated';

import { RunnerUtil } from './util';
import { RunState } from './types';
import { RunnableTestConsumer } from '../consumer/types/runnable';

/**
 * Test Runner
 */
export class Runner {

  constructor(private state: RunState) { }

  get patterns() {
    return this.state.args.map(x => new RegExp(PathUtil.toUnix(x)));
  }

  /**
   * Run all files
   */
  async runFiles() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);

    const files = (await RunnerUtil.getTestFiles(this.patterns, this.state.isolated ? 'test-isolated' : 'test'));

    console.debug('Running', { files });

    await PhaseManager.run('test');

    const manager = this.state.isolated ?
      buildIsolatedTestManager :
      buildStandardTestManager;

    const pool = new WorkPool(manager(consumer), {
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

    const [file, ...args] = this.state.args;

    await PhaseManager.run('test');
    if (this.state.isolated) {
      await TestExecutor.executeIsolated(consumer, file, ...args);
    } else {
      await TestExecutor.execute(consumer, file, ...args);
    }

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run() {
    switch (this.state.mode) {
      case 'single': return await this.runSingle();
      case 'standard': return await this.runFiles();
    }
  }
}