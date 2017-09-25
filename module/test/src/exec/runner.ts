import * as minimist from 'minimist';

import { Agent, AgentPool } from './agent';
import { TapListener, CollectionComplete, Collector, Listener } from './listener';
import { TestUtil } from './test';

interface State {
  format: string;
  tap: boolean;
  tapOutput?: string;
  _: string[];
}

const RunnerOptions = {
  '--': true,
  default: {
    tap: false,
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

  async runWorker(data: { file: string }, done: (err?: any) => void) {
    if (!process.send) {
      return;
    }

    try {
      await TestUtil.executeFile(data.file, {
        emit: process.send.bind(process)
      });
      done();
    } catch (e) {
      done(e);
    }
  }

  async run() {
    try {
      console.debug('Runner Args', this.state);

      let formatter = this.state.format;

      const collector = new Collector();
      const listeners: Listener[] = [
        collector
      ];

      if (this.state.tap) {
        listeners.push(new TapListener());
      }

      const globs = this.state._.slice(2); // strip off node and worker name

      let files = await TestUtil.getTests(globs);
      let agentPool = new AgentPool(require.resolve('../../bin/worker.js'));

      for (let l of listeners) {
        l.onEvent = l.onEvent.bind(l);
      }

      files = files.map(x => x.split(process.cwd() + '/')[1]);

      await agentPool.process(files, async (file, run, agent) => {
        if (agent) {
          for (let l of listeners) {
            agent.listen(l.onEvent);
          }
        }
        run({ file });
      });

      for (let listener of listeners) {
        if ((listener as any).onComplete) {
          (listener as CollectionComplete).onComplete(collector);
        }
      }

      let output: string | undefined;

      if (formatter && formatter !== 'noop') {
        let fn = require('./formatter/' + formatter)
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