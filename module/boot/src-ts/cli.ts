import * as timers from 'timers/promises';
import * as readline from 'readline';
import { Writable } from 'stream';

import { ColorUtil } from './color';

/**
 * Common CLI Utilities
 */
export class CliUtil {

  static #waitState = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

  static isBoolean(x: string): boolean {
    return /^(1|0|yes|no|on|off|auto|true|false)$/i.test(x);
  }

  static toBool(x: string | boolean, def: boolean): boolean;
  static toBool(x?: string | boolean, def?: boolean): boolean | undefined;
  static toBool(x?: string | boolean, def?: boolean): boolean | undefined {
    return x === undefined ? def :
      (typeof x === 'boolean' ? x :
        (this.isBoolean(x) ? /^(1|yes|on|true)$/i.test(x) :
          def));
  }

  static toInt(l: number | undefined, u: number | undefined, v: string, d: number): number {
    let n = +v;
    if (l === undefined && u === undefined) {
      return n;
    }
    if (l !== undefined && n < l) {
      n = d;
    }
    if (u !== undefined && n > u) {
      n = d;
    }
    return n;
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteLine(stream: Writable, text?: string, clear = false): Promise<void> {
    await new Promise<void>(r => readline.cursorTo(stream, 0, undefined, () => {
      if (clear) {
        readline.clearLine(stream, 0);
      }
      if (text) {
        stream.write(text);
        readline.moveCursor(stream, 1, 0);
      }
      r();
    }));
  }

  /**
   * Waiting message with a callback to end
   *
   * @param message Message to share
   * @param delay Delay duration
   */
  static async waiting<T>(message: string, work: Promise<T> | (() => Promise<T>),
    config: { completion?: string, delay?: number, stream?: Writable } = {}
  ): Promise<T> {
    const { stream, delay, completion } = { delay: 1000, stream: process.stderr, ...config };

    const writeLine = this.rewriteLine.bind(this, stream);

    if (!('then' in work)) {
      work = work();
    }

    if (!process.stdout.isTTY) {
      return work; // Dip early
    }

    let i = -1;
    let done = false;
    let value: T | undefined;
    let capturedError: Error | undefined;
    const final = work
      .then(res => value = res)
      .catch(err => capturedError = err)
      .finally(() => done = true);

    if (delay) {
      await Promise.race([timers.setTimeout(delay), final]);
    }

    while (!done) {
      await writeLine(`${this.#waitState[i = (i + 1) % this.#waitState.length]} ${message}`);
      await timers.setTimeout(50);
    }

    if (i >= 0) {
      await writeLine(completion ? `${message} ${completion}\n` : '', true);
    }
    if (capturedError) {
      throw capturedError;
    } else {
      return value!;
    }
  }
}

// Common color support
export const { set: colorSet, template: color } = ColorUtil.buildColorSet({
  input: ['yellow'],
  output: ['magenta'],
  path: ['cyan'],
  success: ['green', 'bold'],
  failure: ['red', 'bold'],
  param: ['green'],
  type: ['cyan'],
  description: ['white', 'faint', 'bold'],
  title: ['white', 'bold'],
  identifier: ['blue', 'bold'],
  subtitle: ['white'],
  subsubtitle: ['white', 'faint']
});