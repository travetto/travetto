import * as commander from 'commander';

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
  args: string[];
}

const FORMAT_MAPPING: { [key: string]: Class<Consumer> } = {
  json: JSONEmitter,
  tap: TapEmitter,
  exec: ExecutionEmitter
};

export class Runner {
  private state: State;

  constructor(argv: string[]) {

    const program = new commander.Command()
      .usage('[-m, --mode <mode>] [-f, --format <format>] <regex of test files ...>')
      .version(require(`${__dirname}/../../package.json`).version)
      .arguments('<regex of test files ...>')
      .option('-f, --format <format>', 'Output format for test results', /^(tap|json|noop|exec)$/, 'tap')
      .option('-m, --mode <mode>', 'Test run mode', /^(single|all)$/, 'all')
      .parse(argv.filter(x => !!x));

    if (program.args.length === 0) {
      program.help();
    }

    this.state = { format: program.format, mode: program.mode, args: program.args } as State;
  }

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
      const result = consumer.summarize();
      return result.summary.fail <= 0;
    }
  }

  async runSome() {
    const consumer = this.getConsumer();
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