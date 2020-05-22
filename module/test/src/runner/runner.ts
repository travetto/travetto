import { FsUtil } from '@travetto/boot';
import { PhaseManager } from '@travetto/base';
import { WorkPool, IterableInputSource } from '@travetto/worker';

import { TestExecutor } from './executor';
import { buildWorkManager } from '../worker/parent';

import { TestUtil } from './util';
import { RunState } from './types';
import { RunnableTestConsumer } from '../consumer/types/runnable';

/**
 * Test Runner
 */
export class Runner {

  constructor(private state: RunState) { }

  /**
   * Find all available test files
   */
  async getFiles() {
    const { args } = this.state; // strip off node and worker name
    // Glob to module path
    const files = await TestUtil.getTests(args.map(x => new RegExp(FsUtil.toUnix(x))));
    return files;
  }

  /**
   * Run all files
   */
  async runFiles() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);

    const files = await this.getFiles();

    console.debug('Running', files);

    await PhaseManager.init('test').run();

    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
      idleTimeoutMillis: 10000,
      min: 1,
      max: this.state.concurrency
    });

    consumer.onStart();

    await pool
      .process(new IterableInputSource(files))
      .finally(() => pool.shutdown());

    const result = consumer.summarize();
    if (result) {
      return result.summary.failed <= 0;
    } else {
      return true;
    }
  }

  /**
   * Run a single file
   */
  async runSingle() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);
    consumer.onStart();

    await PhaseManager.init('test').run();
    const res = await TestExecutor.execute(consumer, this.state.args[0], ...this.state.args.slice(1));

    consumer.summarize();

    return res;
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run() {
    switch (this.state.mode) {
      case 'single': return await this.runSingle();
      default: return await this.runFiles();
    }
  }
}