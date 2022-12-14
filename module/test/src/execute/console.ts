import util from 'util';

import { ConsoleEvent, ConsoleManager } from '@travetto/base';

/**
 * Console capturer.  Hooks into the Console manager, and collects the
 * output into a map for test results
 */
export class ConsoleCapture {

  static out: Record<string, string[]>;

  static start(): void {
    this.out = {};
    ConsoleManager.set(this);
  }

  static onLog({ level, args }: ConsoleEvent): void {
    (this.out[level] = this.out[level] ?? []).push(
      args
        .map((x => typeof x === 'string' ? x : util.inspect(x, false, 4)))
        .join(' ')
    );
  }

  static end(): Record<string, string> {
    const ret = this.out ?? {};
    this.out = {};
    ConsoleManager.clear();
    return Object.fromEntries(Object.entries(ret).map(([k, v]) => [k, v.join('\n')]));
  }
}