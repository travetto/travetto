import { FsUtil, EnvUtil } from '@travetto/boot';
import { Env, PhaseManager } from '@travetto/base';
import { WorkPool, ArrayInputSource } from '@travetto/worker';

import { ConsumerManager } from '../consumer/manager';
import { Consumer } from '../model/consumer';

import { TestExecutor } from './executor';
import { buildWorkManager } from '../worker/parent';

import { watch } from './watcher';
import { TestUtil } from './util';

export interface State {
  format: string;
  consumer?: Consumer;
  mode: 'single' | 'watch' | 'all';
  concurrency: number;
  args: string[];
}

export class Runner {

  constructor(private state: State) { }

  async getFiles() {
    const { args } = this.state; // strip off node and worker name
    // Glob to module path
    const files = await TestUtil.getTests(args.map(x => new RegExp(FsUtil.toUnix(x))));
    return files;
  }

  async runFiles() {
    const consumer = ConsumerManager.create(this.state.consumer ?? this.state.format);

    const files = await this.getFiles();

    console.debug('Running', files);

    await PhaseManager.init('test').run();

    const pool = new WorkPool(buildWorkManager.bind(null, consumer), {
      idleTimeoutMillis: 10000,
      min: EnvUtil.isTrue('execution_reusable') ? 1 : 0,
      max: this.state.concurrency
    });

    if (consumer.onStart) {
      consumer.onStart();
    }

    await pool
      .process(new ArrayInputSource(files))
      .finally(() => pool.shutdown());

    if (consumer.summarize) {
      const result = consumer.summarize();
      return result.summary.fail <= 0;
    } else {
      return true;
    }
  }

  async runSingle() {
    const consumer = ConsumerManager.create(this.state.consumer ?? this.state.format);
    if (consumer.onStart) {
      consumer.onStart();
    }

    await PhaseManager.init('test').run();
    const res = await TestExecutor.execute(consumer, this.state.args);

    if (consumer.summarize) {
      consumer.summarize();
    }

    return res;
  }

  async run() {
    switch (this.state.mode) {
      case 'single': return await this.runSingle();
      case 'watch': return await watch();
      default: return await this.runFiles();
    }
  }
}