import * as util from 'util';
import { ConsoleManager, ConsolePayload } from '@travetto/base';

export class ConsoleCapture {

  static out: Record<string, string[]>;

  static start() {
    this.out = {};
    ConsoleManager.set(this);
  }

  static processArgs(payload: ConsolePayload, args: any[]) {
    return args.map((x => typeof x === 'string' ? x : util.inspect(x, false, 4)));
  }

  static invoke({ level }: ConsolePayload, args: any[]) {
    (this.out[level] = this.out[level] ?? []).push(args.join(' '));
  }

  static end() {
    const ret = this.out;
    this.out = {};
    ConsoleManager.clear();
    return Object.fromEntries(Object.entries(ret).map(([k, v]) => [k, v.join('\n')]));
  }
}