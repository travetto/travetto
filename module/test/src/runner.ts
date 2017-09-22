import { Executor } from './service';
import { TapListener, CollectionComplete, Collector } from './listener';
import * as minimist from 'minimist';

interface State {
  format: string;
  tap: boolean;
  tapOutput?: string;
  _: string[];
}

export class Runner {
  private state: State;

  constructor(args: string[] = process.argv) {
    this.state = minimist(args, {
      '--': true,
      default: {
        tap: false,
        format: 'noop'
      },
      alias: { t: 'tap', f: 'format' },
      boolean: ['tap'],
      string: ['format', 'tapOutput'],
    }) as any as State;
  }

  async run() {
    try {
      let formatter = this.state.format;

      const collector = new Collector();
      const listeners = [
        collector,
        new TapListener()
      ];

      await Executor.init();

      const results = await Executor.execute(this.state._.slice(2), listeners); // Pass globs

      for (let listener of listeners) {
        if ((listener as any).onComplete) {
          (listener as CollectionComplete).onComplete(collector);
        }
      }

      let output = Object.values(formatter)[0](results);
      if (output) {
        console.log(output);
      }
    } catch (e) {
      console.error(e);
    }
  }
}