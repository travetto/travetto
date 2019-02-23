import { FileCache, PhaseManager, Shutdown, Env, FsUtil } from '@travetto/base';
import { WorkerUtil, WorkerPool, WorkerArrayInputSource } from '@travetto/worker';

import { ConsumerManager } from '../consumer/manager';
import { Consumer } from '../model/consumer';

import { TestExecutor } from './executor';
import { workerFactory } from '../worker/factory';
import { Events } from '../worker/types';

import { watch } from './watcher';
import { TestUtil } from './util';

interface State {
  format: string;
  consumer?: Consumer;
  mode: 'single' | 'watch' | 'all';
  concurrency: number;
  args: string[];
}

export class Runner {
  constructor(private state: State) {
    if (!process.send) { // Remove if not child
      Shutdown.onShutdown(`Remove-Root-TempDir`, // Remove when done, this is for single interaction
        () => new FileCache(Env.cwd).clear(), true);
    }
  }

  async getFiles() {
    const { args } = this.state; // strip off node and worker name
    // Glob to module path
    const files = await TestUtil.getTests(args.map(x => new RegExp(FsUtil.toUnix(x))));
    return files;
  }

  async runFiles() {
    const consumer = ConsumerManager.create(this.state.consumer || this.state.format);

    const files = await this.getFiles();
    const errors: Error[] = [];

    await new PhaseManager('test').load().run();

    const pool = new WorkerPool(workerFactory, {
      idleTimeoutMillis: 10000,
      min: Env.isTrue('EXECUTION_REUSABLE') ? 1 : 0,
      max: this.state.concurrency
    });

    if (consumer.onStart) {
      consumer.onStart();
    }

    await pool.process(
      new WorkerArrayInputSource(files),
      async (file, exe) => {
        exe.listen(consumer.onEvent as any);

        const complete = exe.listenOnce(Events.RUN_COMPLETE);
        exe.send(Events.RUN, { file });

        const { error } = await complete;
        if (error) {
          const fullError = WorkerUtil.deserializeError(error);
          errors.push(fullError);
        }
      }
    );

    await pool.shutdown();

    if (errors.length) {
      throw errors[0];
    }

    if (consumer.summarize) {
      const result = consumer.summarize();
      return result.summary.fail <= 0;
    }
  }

  async runSingle() {
    const consumer = ConsumerManager.create(this.state.consumer || this.state.format);
    await new PhaseManager('test').load().run();
    return await TestExecutor.execute(consumer, this.state.args);
  }

  async run() {
    switch (this.state.mode) {
      case 'single': return await this.runSingle();
      case 'watch': return await watch();
      default: return await this.runFiles();
    }
  }
}