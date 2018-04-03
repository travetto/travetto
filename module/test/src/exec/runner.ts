import * as minimist from 'minimist';

import { ExecutorPool, ChildExecutor } from '@travetto/exec';
import { TestUtil } from './test';
import { ExecutorEmitter, Consumer, AllResultsCollector, TapEmitter, JSONEmitter } from './consumer';
import { AllSuitesResult } from '../model/suite';
import { client, Events } from './executor';

interface State {
  format: 'tap' | 'json' | 'noop';
  _: string[];
}

const RunnerOptions = {
  '--': true,
  default: {
    format: 'tap'
  },
  alias: { f: 'format' },
  string: ['format'],
};

export class Runner {
  private state: State;

  constructor(args: string[] = process.argv) {
    this.state = minimist(args, RunnerOptions) as any as State;
  }

  async runExecutor(data: { file: string }) {
    await TestUtil.executeFile(data.file, new ExecutorEmitter());
  }

  async run() {
    try {
      console.debug('Runner Args', this.state);

      const collector = new AllResultsCollector();
      const consumers: Consumer[] = [collector];

      switch (this.state.format) {
        case 'tap':
          consumers.push(new TapEmitter());
          break;
        case 'json':
          consumers.push(new JSONEmitter());
          break;
      }

      const globs = this.state._.slice(2); // strip off node and worker name

      let files = await TestUtil.getTests(globs);

      for (const l of consumers) {
        l.onEvent = l.onEvent.bind(l);
      }

      files = files.map(x => x.split(`${process.cwd()}/`)[1]);

      const pool = new ExecutorPool<ChildExecutor>();
      const errors: Error[] = [];

      await pool.process(files, client(consumers, err => {
        errors.push(err);
      }));

      for (const cons of consumers) {
        if (cons.onSummary) {
          cons.onSummary(collector.summary);
        }
      }

      return collector.summary;
    } catch (e) {
      console.error(e);
    }
  }
}