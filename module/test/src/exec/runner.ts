import * as minimist from 'minimist';

import { AgentPool } from '../agent';
import { TestUtil } from './test';
import { WorkerEmitter, Consumer, Collector, TapEmitter, JSONEmitter } from './consumer';
import { AllSuitesResult } from '../model/suite';

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

  async runWorker(data: { file: string }) {
    if (!process.send) {
      return;
    }

    await TestUtil.executeFile(data.file, new WorkerEmitter());
  }

  async run() {
    try {
      console.debug('Runner Args', this.state);

      const collector = new Collector();
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

      const agentPool = new AgentPool(require.resolve('./worker.js'));

      collector.summary.errors = await agentPool.process(files, async (file, run, agent) => {
        if (agent) {
          for (const l of consumers) {
            agent.listen(l.onEvent);
          }
        }
        run({ file });
      });

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