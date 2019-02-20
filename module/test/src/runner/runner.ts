import { FileCache, PhaseManager, Shutdown, Env, FsUtil } from '@travetto/base';
import { WorkerUtil, WorkerPool, WorkerArrayInputSource } from '@travetto/worker';
import { Class } from '@travetto/registry';

import { TestExecutor } from './executor';
import { Consumer } from '../consumer/types';
import { JSONEmitter } from '../consumer/json';
import { ExecutionEmitter } from '../consumer/execution';
import { EventStream } from '../consumer/event-stream';
import { TapEmitter } from '../consumer/tap';
import { AllResultsCollector } from '../consumer/collector';

import { workerFactory } from '../worker/factory';
import { Events } from '../worker/types';

import { watch } from './watcher';

const FORMAT_MAPPING: { [key: string]: Class<Consumer> } = {
  json: JSONEmitter,
  tap: TapEmitter,
  event: EventStream,
  exec: ExecutionEmitter
};

interface State {
  format: (keyof typeof FORMAT_MAPPING);
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

  getConsumer(): Consumer & { summarize?: () => AllResultsCollector } {
    const consumers: Consumer[] = [];

    if (this.state.consumer) {
      consumers.push(this.state.consumer);
    } else {
      const fmtClass = FORMAT_MAPPING[this.state.format];

      if (fmtClass) {
        consumers.push(new fmtClass());
      }
    }

    for (const c of consumers) {
      if (c.onSummary) {
        consumers.unshift(new AllResultsCollector());
        break;
      }
    }

    for (const l of consumers) {
      l.onEvent = l.onEvent.bind(l);
    }

    if (consumers.length === 0) {
      return consumers[0];
    } else {
      const multi: Consumer & { summarize?: () => any } = {
        onEvent(e: any) {
          for (const c of consumers) {
            c.onEvent(e);
          }
        }
      };

      if (consumers[0] instanceof AllResultsCollector) {
        const all = consumers[0] as AllResultsCollector;
        multi.summarize = () => {
          for (const c of consumers.slice(1)) {
            if (c.onSummary) {
              c.onSummary(all.summary);
            }
          }
          return all;
        };
      }

      return multi;
    }
  }

  async getFiles() {
    const { args } = this.state; // strip off node and worker name
    // Glob to module path
    const files = await TestExecutor.getTests(args.map(x => new RegExp(FsUtil.toUnix(x))));
    return files;
  }

  async runFiles() {
    const consumer = this.getConsumer();

    const files = await this.getFiles();
    const errors: Error[] = [];

    await new PhaseManager('test').load().run();

    const pool = new WorkerPool(workerFactory, {
      idleTimeoutMillis: 10000,
      min: Env.isTrue('EXECUTION_REUSABLE') ? 1 : 0,
      max: this.state.concurrency
    });

    await pool.process(
      new WorkerArrayInputSource(files),
      async (file, exe) => {
        exe.listen(consumer.onEvent as any);

        const complete = exe.listenOnce(Events.RUN_COMPLETE);
        exe.send(Events.RUN, { file });

        const { error } = await complete;
        const fullError = WorkerUtil.deserializeError(error);
        errors.push(fullError);
      }
    );

    await pool.shutdown();

    for (const err of errors) {
      if (err && 'FATAL' in err) {
        throw err;
      }
    }

    if (consumer.summarize) {
      const result = consumer.summarize();
      return result.summary.fail <= 0;
    }
  }

  async runSingle() {
    const consumer = this.getConsumer();
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