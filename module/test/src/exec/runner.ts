import * as minimist from 'minimist';

import { Agent, AgentPool } from './agent';
import { TapListener, CollectionComplete, Collector, Listener } from './listener';
import { TestUtil } from './test';
import { AllSuitesResult } from '../model/suite';

interface State {
  format: string;
  tap: boolean;
  tapOutput?: string;
  _: string[];
}

const RunnerOptions = {
  '--': true,
  default: {
    tap: true,
    format: 'noop'
  },
  alias: { t: 'tap', f: 'format' },
  boolean: ['tap'],
  string: ['format', 'tapOutput'],
};

export class Runner {
  private state: State;

  constructor(args: string[] = process.argv) {
    this.state = minimist(args, RunnerOptions) as any as State;
  }

  async runWorker(data: { file: string }) {
    if (!process.send) {
      return;
    }

    await TestUtil.executeFile(data.file, {
      emit: process.send.bind(process)
    });
  }

  async run() {
    try {
      console.debug('Runner Args', this.state);

      const formatter = this.state.format;

      const collector = new Collector();
      const listeners: Listener[] = [
        collector
      ];

      if (this.state.tap) {
        listeners.push(new TapListener());
      }

      const globs = this.state._.slice(2); // strip off node and worker name

      let files = await TestUtil.getTests(globs);

      for (const l of listeners) {
        l.onEvent = l.onEvent.bind(l);
      }

      files = files.map(x => x.split(process.cwd() + '/')[1]);

      const agentPool = new AgentPool(require.resolve('../../bin/worker.js'));

      collector.errors = await agentPool.process(files, async (file, run, agent) => {
        if (agent) {
          for (const l of listeners) {
            agent.listen(l.onEvent);
          }
        }
        run({ file });
      });

      for (const listener of listeners) {
        if ((listener as any).onComplete) {
          (listener as CollectionComplete).onComplete(collector);
        }
      }

      let output: string | undefined;

      if (formatter && formatter !== 'noop') {
        const fn = require('./formatter/' + formatter) as { [key: string]: (all: AllSuitesResult) => string | undefined };
        output = Object.values(fn)[0](collector.allSuites);
      }
      if (output) {
        console.log(output);
      }

      return collector.allSuites;
    } catch (e) {
      console.error(e);
    }
  }
}