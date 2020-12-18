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

  get patterns() {
    return this.state.args.map(x => new RegExp(FsUtil.toUnix(x)));
  }

  /**
   * Run all files
   */
  async runFiles() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);

    const files = (await TestUtil.getTests(this.patterns))
      .filter(x => !x.includes('/extension/')); // Do not include extensions

    console.debug('Running', { files });

    await PhaseManager.create('test').run();

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

    await PhaseManager.create('test').run();
    await TestExecutor.execute(consumer, this.state.args[0], ...this.state.args.slice(1));

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run all files
   */
  async runExtensions() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);

    const files = await TestUtil.getTests(this.patterns, 'test/extension');

    console.debug('Running', { files });

    await PhaseManager.create('test').run();

    const pool = new WorkPool(buildWorkManager.bind(null, consumer, 'extension'), {
      idleTimeoutMillis: 10000,
      min: 1,
      max: 1
    }); // One at a time

    consumer.onStart();

    await pool
      .process(new IterableInputSource(files))
      .finally(() => pool.shutdown());

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run() {
    switch (this.state.mode) {
      case 'extension': return await this.runExtensions();
      case 'single': return await this.runSingle();
      default: return await this.runFiles();
    }
  }
}