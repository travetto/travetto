import util from 'node:util';

import { ConsoleEvent, ConsoleListener, ConsoleManager } from '@travetto/runtime';
import { TestLog } from '../model/test';

/**
 * Console capturer.  Hooks into the Console manager, and collects the
 * output into a map for test results
 */
export class ConsoleCapture implements ConsoleListener {
  static #listener: ConsoleListener = ConsoleManager.get();

  out: TestLog[];

  start(): this {
    this.out = [];
    ConsoleManager.set(this);
    return this;
  }

  log({ args, scope: _, ...rest }: ConsoleEvent): void {
    this.out.push({
      ...rest,
      message: args
        .map((arg => typeof arg === 'string' ? arg : util.inspect(arg, false, 5)))
        .join(' ')
    });
  }

  end(): TestLog[] {
    const result = this.out ?? [];
    this.out = [];
    ConsoleManager.set(ConsoleCapture.#listener);
    return result;
  }
}