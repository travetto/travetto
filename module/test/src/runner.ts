import { Agent } from './service';
import { TapListener, CollectionComplete, Collector } from './listener';
import * as minimist from 'minimist';
import { TestUtil } from './service/test';
import { AgentPool } from './service/agent/pool';

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

const COMMAND = require.resolve('../bootstrap-worker.js');

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
      let formatter = this.state.format;

      const collector = new Collector();
      const listeners = [
        collector,
        new TapListener()
      ];

      const globs = this.state._.slice(2);

      let files = await TestUtil.getTests(globs);
      let agentPool = new AgentPool(`COMMAND`);

      for (let l of listeners) {
        l = l.onEvent.bind(l);
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

      let output = Object.values(formatter)[0](collector.allSuites);
      if (output) {
        console.log(output);
      }
    } catch (e) {
      console.error(e);
    }
  }
}