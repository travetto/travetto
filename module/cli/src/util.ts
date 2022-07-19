import * as readline from 'readline';
import { Writable } from 'stream';

import { CompletionConfig } from './types';

/**
 * Common CLI Utilities
 */
export class CliUtil {

  static #waitState = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

  static isBoolean(x: string) {
    return /^(1|0|yes|no|on|off|auto|true|false)$/i.test(x);
  }

  static toBool(x: string | boolean, def: boolean): boolean;
  static toBool(x?: string | boolean, def?: boolean): boolean | undefined;
  static toBool(x?: string | boolean, def?: boolean) {
    return x === undefined ? true :
      (typeof x === 'boolean' ? x :
        (this.isBoolean(x) ? /^(1|yes|on|true)$/i.test(x) :
          def));
  }

  static toInt(l: number | undefined, u: number | undefined, v: string, d: number) {
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
   * Get code completion values
   */
  static async getCompletion(compl: CompletionConfig, args: string[]) {
    args = args.slice(0); // Copy as we mutate

    const cmd = args.shift()!;

    let last = cmd;
    let opts: string[] = [];

    // List all commands
    if (!compl.task[cmd]) {
      opts = compl.all;
    } else {
      // Look available sub commands
      last = args.pop() ?? '';
      const second = args.pop() ?? '';
      let flag = '';

      if (last in compl.task[cmd]) {
        flag = last;
        last = '';
      } else if (second in compl.task[cmd]) {
        // Look for available flags
        if (compl.task[cmd][second].includes(last)) {
          flag = '';
          last = '';
        } else {
          flag = second;
        }
      }
      opts = compl.task[cmd][flag];
    }

    return last ? opts.filter(x => x.startsWith(last)) : opts.filter(x => !x.startsWith('-'));
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteLine(stream: Writable, text?: string, clear = false) {
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

  static sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  /**
   * Waiting message with a callback to end
   *
   * @param message Message to share
   * @param delay Delay duration
   */
  static async waiting<T>(message: string, work: Promise<T> | (() => Promise<T>),
    config: { completion?: string, delay?: number, stream?: Writable } = {}
  ) {
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
      await Promise.race([this.sleep(delay), final]);
    }

    while (!done) {
      await writeLine(`${this.#waitState[i = (i + 1) % this.#waitState.length]} ${message}`);
      await this.sleep(50);
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