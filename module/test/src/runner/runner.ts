import * as minimist from 'minimist';
import * as fs from 'fs';
import * as util from 'util';

import { ArrayDataSource, deserializeError } from '@travetto/exec';
import { ExecuteUtil } from './execute';
import { ExecutionEmitter, Consumer, AllResultsCollector, TapEmitter, JSONEmitter } from '../consumer';
import { AllSuitesResult } from '../model/suite';
import { client, Events } from './communication';
import { Class } from '@travetto/registry';
import { getCiphers } from 'crypto';
import { bulkRequire } from '@travetto/base';
import * as _ from 'lodash';
import { watch } from './watcher';

const farmhash = require('farmhash');

interface State {
  format: 'tap' | 'json' | 'noop' | 'exec';
  mode: 'single' | 'all' | 'watch' | 'singleTest' | 'singleLine';
  _: string[];
  '--': string[];
}

const RunnerOptions = {
  '--': true,
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
}

export class Runner {
  private state: State;

  constructor(args: string[] = process.argv) {
    this.state = minimist(args, RunnerOptions) as any as State;
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
            c.onEvent(e)
          }
        }
      };

      if (consumers[0] instanceof AllResultsCollector) {
        const all = consumers[0] as AllResultsCollector;
        multi.summarize = () => {
          for (const c of consumers.slice(1)) {
            if (c.onSummary) {
              c.onSummary(all.summary)
            }
          }
        }
      }

      return multi;
    }
  }

  async getFiles() {
    const globs = this.state['--'].length ? this.state['--'] : this.state._.slice(2); // strip off node and worker name
    let files = await ExecuteUtil.getTests(globs);

    files = files.map(x => x.split(`${process.cwd()}/`)[1]);

    return files;
  }

  async runAll() {
    const consumer = this.getConsumer();

    const files = await this.getFiles();
    const errors: Error[] = [];

    await client().process(
      new ArrayDataSource(files),
      async (file, exe) => {

        exe.listen(consumer.onEvent as any);

        const complete = exe.listenOnce(Events.RUN_COMPLETE);
        exe.send(Events.RUN, { file });
        const { error } = await complete;

        errors.push((deserializeError(error)));
      }
    );

    if (consumer.summarize) {
      return consumer.summarize();
    }
  }

  async runSingle() {
    const consumer = this.getConsumer();
    const files = await this.getFiles();
    const file = files[0];
    await ExecuteUtil.executeFile(file, consumer);
  }

  async runSingleTest() {
    const consumer = this.getConsumer();
    const [file, cls, method] = this.state['--'];
    await ExecuteUtil.executeFileTest(file, cls, method, consumer);
  }

  async run() {
    try {
      console.log('Runner Args', this.state);

      switch (this.state.mode) {
        case 'all': return await this.runAll();
        case 'single': return await this.runSingle();
        case 'singleTest': return await this.runSingleTest();
        case 'watch': return await watch();
      }

    } catch (e) {
      console.error(e);
    }
  }
}