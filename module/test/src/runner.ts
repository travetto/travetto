import { Executor } from './service';
import { TapListener } from './listener';
import * as minimist from 'minimist';

interface State {
  format: string;
  tap: boolean;
  tapOutput?: string;
}

export class Runner {
  private state: State;

  constructor() {
    this.state = minimist(process.argv, {
      '--': true,
      default: {
        tap: false,
        format: 'noop'
      },
      alias: { t: 'tap', f: 'format' },
      boolean: ['tap'],
      string: ['format', 'tapOutput'],
    }) as any as State;

    console.log(this.state);
  }

  async run() {
    try {
      let formatter = (process.env.FORMATTER || 'noop');
      let listeners = [];
      let results = await Executor.exec(process.argv.slice(2), [
        new TapListener()
      ]); // Pass globs
      let output = Object.values(formatter)[0](results);
      if (output) {
        console.log(output);
      }
    } catch (e) {
      console.error(e);
    }
  }
}