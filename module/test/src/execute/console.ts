import util from 'node:util';

import { ConsoleEvent, ConsoleListener, ConsoleManager } from '@travetto/base';

/**
 * Console capturer.  Hooks into the Console manager, and collects the
 * output into a map for test results
 */
export class ConsoleCapture implements ConsoleListener {
  static #listener: ConsoleListener = ConsoleManager.get();

  out: Record<string, string[]>;

  start(): this {
    this.out = {};
    ConsoleManager.set(this);
    return this;
  }

  log({ level, args }: ConsoleEvent): void {
    (this.out[level] = this.out[level] ?? []).push(
      args
        .map((x => typeof x === 'string' ? x : util.inspect(x, false, 5)))
        .join(' ')
    );
  }

  end(): Record<string, string> {
    const ret = this.out ?? {};
    this.out = {};
    ConsoleManager.set(ConsoleCapture.#listener);
    return Object.fromEntries(Object.entries(ret).map(([k, v]) => [k, v.join('\n')]));
  }
}