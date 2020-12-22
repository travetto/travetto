import * as util from 'util';
import { ConsoleManager, LogLevel } from '@travetto/base';

/**
 * Console capturer.  Hooks into the Console manager, and collects the
 * output into a map for test results
 */
export class ConsoleCapture {

  static out: Record<string, string[]>;

  static start() {
    this.out = {};
    ConsoleManager.set(this);
  }

  static onLog(level: LogLevel, ctx: { file: string, line: number }, args: any[]) {
    (this.out[level] = this.out[level] ?? []).push(
      args
        .map((x => typeof x === 'string' ? x : util.inspect(x, false, 4)))
        .join(' ')
    );
  }

  static end() {
    const ret = this.out ?? {};
    this.out = {};
    ConsoleManager.clear();
    return Object.fromEntries(Object.entries(ret).map(([k, v]) => [k, v.join('\n')]));
  }
}