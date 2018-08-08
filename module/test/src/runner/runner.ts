import * as minimist from 'minimist';

import { PhaseManager } from '@travetto/base';
import { ArrayDataSource } from '@travetto/pool';
import { ExecUtil } from '@travetto/exec';
import { Class } from '@travetto/registry';

import { TestExecutor } from './executor';
import { ExecutionEmitter, Consumer, AllResultsCollector, TapEmitter, JSONEmitter } from '../consumer';
import { client, Events } from './communication';
import { watch } from './watcher';

interface State {
  format: 'tap' | 'json' | 'noop' | 'exec';
  mode: 'single' | 'watch' | 'all';
  _: string[];
}

const RUNNER_OPTIONS = {
  default: {
    format: 'tap',
    mode: 'all',
  },
  alias: { f: 'format', m: 'mode' },
  string: ['format', 'mode'],
};

const FORMAT_MAPPING: { [key: string]: Class<Consumer> } = {
  json: JSONEmitter,
  tap: TapEmitter,
  exec: ExecutionEmitter
};

export class Runner {
  private state: State;

  constructor(args: string[] = process.argv) {
    this.state = minimist(args, RUNNER_OPTIONS) as any as State;
  }

  getConsumer(): Consumer & { summarize?: () => any } {
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
        };
      }

      return multi;
    }
  }

  async getFiles() {
    const globs = this.state._; // strip off node and worker name
    // Glob to module path
    const files = await TestExecutor.getTests(globs.map(x => new RegExp(`${x}`.replace(/[\\\/]/g, '/'))));
    return files;
  }

  async runFiles() {
    const consumer = this.getConsumer();

    const files = await this.getFiles();
    const errors: Error[] = [];

    await new PhaseManager('test').load().run();

    await client().process(
      new ArrayDataSource(files),
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
      return consumer.summarize();
    }
  }

  async runSome() {
    const consumer = this.getConsumer();
    const args: string[] = this.state._;
    return await TestExecutor.execute(consumer, args);
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