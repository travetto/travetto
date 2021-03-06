import * as fs from 'fs';

import { ExecUtil, PathUtil } from '@travetto/boot';
import { PhaseManager } from '@travetto/base';
import { WorkPool, IterableInputSource } from '@travetto/worker';
import { SystemUtil } from '@travetto/base/src/internal/system';

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
    return this.state.args.map(x => new RegExp(PathUtil.toUnix(x)));
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
   * Run isolated suite
   */
  async runIsolated() {
    const consumer = RunnableTestConsumer.get(this.state.consumer ?? this.state.format);
    consumer.onStart();

    const [file, ...args] = this.state.args;

    // Read modules for extensions
    const modules = [...(await fs.promises.readFile(file, 'utf8'))
      .matchAll(/\/\/\s*@file-if\s+(@travetto\/[A-Za-z0-9\-]+)/g)]
      .map(x => x[1]);

    const env = {
      TRV_MODULES: modules.join(','),
      TRV_TEST_FORMAT: 'exec',
      TRV_CACHE: `.trv_cache_${SystemUtil.naiveHash(file)}`
    };

    await PhaseManager.run('test');
    const proc = ExecUtil.fork(require.resolve('../../bin/plugin-test'), [file, ...args], { env });
    proc.process.on('message', e => consumer.onEvent(e));
    await proc.result;

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
    await TestExecutor.execute(consumer, file, ...args);

    return consumer.summarizeAsBoolean();
  }

  /**
   * Run the runner, based on the inputs passed to the constructor
   */
  async run() {
    switch (this.state.mode) {
      case 'isolated': return await this.runIsolated();
      case 'single': return await this.runSingle();
      case 'standard': return await this.runFiles();
    }
  }
}