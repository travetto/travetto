import * as util from 'util';
import { ConsoleManager } from '@travetto/base';

export class ConsoleCapture {

  static out: Record<string, string>;

  static start() {
    this.out = {};
    ConsoleManager.set(
      {
        invoke: ({ level }, args: any[]) => {
          this.out[level] = `${this.out[level] ?? ''}${args.join(' ')}\n`;
        }
      },
      x => typeof x === 'string' ? x : util.inspect(x, false, 4),
      true
    );
  }

  static end() {
    const ret = this.out;
    this.out = {};
    ConsoleManager.set(null);
    return ret;
  }
}