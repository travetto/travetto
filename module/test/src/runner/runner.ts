import { PhaseManager } from '@travetto/base';
import { ExecUtil, ArrayExecutionSource } from '@travetto/exec';

import { TestExecutor } from './executor';
import { Consumer } from '../consumer/types';
import { JSONEmitter } from '../consumer/json';
import { ExecutionEmitter } from '../consumer/execution';
import { EventStream } from '../consumer/event-stream';
import { TapEmitter } from '../consumer/tap';
import { AllResultsCollector } from '../consumer/collector';

import { client, Events } from './communication';
import { watch } from './watcher';

const FORMAT_MAPPING = {
  json: JSONEmitter,
  tap: TapEmitter,
  event: EventStream,
  exec: ExecutionEmitter
};

interface State {
  format: (keyof typeof FORMAT_MAPPING);
  mode: 'single' | 'watch' | 'all';
  concurrency: number;
  args: string[];
}

export class Runner {
  constructor(private state: State) { }

  getConsumer(): Consumer & { summarize?: () => AllResultsCollector } {
    const consumers: Consumer[] = [];
    const fmtClass = FORMAT_MAPPING[this.state.format];

    if (fmtClass) {
      consumers.push(new fmtClass());
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
    const files = await TestExecutor.getTests(args.map(x => new RegExp(`${x}`.replace(/[\\\/]/g, '/'))));
    return files;
  }

  async runFiles() {
    const consumer = this.getConsumer();

    const files = await this.getFiles();
    const errors: Error[] = [];

    await new PhaseManager('test').load().run();

    await client(this.state.concurrency).process(
      new ArrayExecutionSource(files),
      async (file, exe) => {
        exe.listen(consumer.onEvent as any);

        const complete = exe.listenOnce(Events.RUN_COMPLETE);
        exe.send(Events.RUN, { file });

        const { error } = await complete;
        const deserialized = ExecUtil.deserializeError(error);
        errors.push(deserialized);
      }
    );

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

  async runSome() {
    const consumer = this.getConsumer();
    await new PhaseManager('test').load().run();
    return await TestExecutor.execute(consumer, this.state.args);
  }

  async run() {
    try {
      switch (this.state.mode) {
        case 'single': return await this.runSome();
        case 'watch': return await watch();
        default: return await this.runFiles();
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}