import tty from 'tty';
import timers from 'timers/promises';
import readline from 'readline';

import { TypedObject, ObjectUtil } from '@travetto/base';
import { ColorDefineUtil, RGBInput } from './color-define';

export type ColorLevel = 0 | 1 | 2 | 3;

export type Style =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

export type TerminalTable = {
  init(...header: string[]): Promise<void>;
  update(row: number, output: string): Promise<void>;
  finish(): Promise<void>;
};

const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;

type TerminalOpConfig = {
  hideCursor?: boolean;
};

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

/**
 * Terminal utilities
 */
export class TerminalUtil {

  static disableCursor(stream: tty.WriteStream): void {
    stream.write('\x1B[?25l');
  }

  static enableCursor(stream: tty.WriteStream): void {
    stream.write('\x1B[?25h');
  }

  static removeAnsiSequences(output: string): string {
    // eslint-disable-next-line no-control-regex
    return output.replace(/(\x1b|\x1B)\[[?]?[0-9;]+[A-Za-z]/g, '');
  }

  static getStreamColorLevel(stream: tty.WriteStream): ColorLevel {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return stream.isTTY ? COLOR_LEVEL_MAP[stream.getColorDepth() as 1 | 4 | 8 | 24] : 0;
  }

  /**
   * Get styled levels, 0-3
   */
  static getStyledLevels(inp: Style | RGBInput): [string, string][] {
    const cfg = ObjectUtil.isPlainObject(inp) ? inp : { text: inp };
    const levelPairs: [string, string][] = [['', '']];
    const text = cfg.text ? ColorDefineUtil.getColorCodes(cfg.text, false) : undefined;
    const bg = cfg.background ? ColorDefineUtil.getColorCodes(cfg.background, true) : undefined;

    for (const level of [1, 2, 3]) {
      const prefix: number[] = [];
      const suffix: number[] = [];
      for (const key of TypedObject.keys(cfg)) {
        if (!cfg[key]) {
          continue;
        }
        switch (key) {
          case 'inverse': prefix.push(7); suffix.push(27); break;
          case 'underline': prefix.push(4); suffix.push(24); break;
          case 'italic': prefix.push(3); suffix.push(23); break;
          case 'blink': prefix.push(5); suffix.push(25); break;
          case 'text': prefix.push(...text![level][0]); suffix.push(...text![level][1]); break;
          case 'background': prefix.push(...bg![level][0]); suffix.push(...bg![level][1]); break;
        }
      }
      levelPairs[level] = [`\x1b[${prefix.join(';')}m`, `\x1b[${suffix.reverse().join(';')}m`];
    }
    return levelPairs;
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteLine(stream: tty.WriteStream, text?: string, clear = false): Promise<void> {
    await new Promise<void>(r => readline.cursorTo(stream, 0, undefined, r));
    if (clear) {
      await new Promise<void>(r => readline.clearLine(stream, 0, r));
    }
    if (text) {
      stream.write(text);
      await new Promise<void>(r => readline.moveCursor(stream, 1, 0, r));
    }
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteChar(stream: tty.WriteStream, pos: number, text: string): Promise<void> {
    await new Promise<void>(r => readline.cursorTo(stream, pos, undefined, r));
    stream.write(text);
  }

  /**
   * Waiting message with a callback to end
   *
   * @param message Message to share
   * @param delay Delay duration
   */
  static async waiting<T>(stream: tty.WriteStream, message: string, work: Promise<T> | (() => Promise<T>),
    config: TerminalOpConfig & { completion?: string, delay?: number, waitingStates?: string[] } = {}
  ): Promise<T> {
    const { delay, completion } = { delay: 1000, ...config };

    if (!ObjectUtil.isPromise(work)) {
      work = work();
    }

    let done = false;
    let value: T | undefined;
    let capturedError: Error | undefined;
    const final = work
      .then(res => value = res)
      .catch(err => capturedError = err)
      .finally(() => done = true);

    if (stream.isTTY) {
      let i = -1;

      if (config.hideCursor) {
        this.disableCursor(stream);
      }

      if (delay) {
        await Promise.race([timers.setTimeout(delay), final]);
      }

      stream.write(`X ${message}`);

      const states = config.waitingStates ?? STD_WAIT_STATES;

      while (!done) {
        await this.rewriteChar(stream, 0, states[i = (i + 1) % states.length]);
        await timers.setTimeout(50);
      }

      if (i >= 0) {
        await this.rewriteLine(stream, completion ? `${message} ${completion}\n` : '', true);
      }

      if (config.hideCursor) {
        this.enableCursor(stream);
      }
    } else {
      await final;
      if (!capturedError && completion) {
        stream.write(`${message} ${completion}\n`);
      }
    }

    if (capturedError) {
      throw capturedError;
    } else {
      return value!;
    }
  }

  /**
   * Provides an updatable table where you define the row/col count at the beginning, and
   *  then are able to update rows on demand.
   */
  static makeTable(stream: tty.WriteStream, rows: number, config: TerminalOpConfig = {}): TerminalTable {

    let cursorRow = 0;
    const responses: string[] = [];

    async function init(...header: string[]): Promise<void> {
      for (const line of header) {
        stream.write(`${line}\n`);
      }
      stream.write(`${'\n'.repeat(rows)}\n`);
      cursorRow = rows + 1;
    }

    const counts = new Array(rows).fill(0);

    if (stream.isTTY) {
      return {
        async init(...header: string[]): Promise<void> {
          if (config.hideCursor) {
            TerminalUtil.disableCursor(stream);
          }
          await init(...header);
        },
        async update(row, output): Promise<void> {
          if (counts[row] > 0) {
            await timers.setTimeout(500);
          }
          counts[row] += 1;
          readline.moveCursor(stream, 0, row - cursorRow);
          readline.clearLine(stream, 1);
          cursorRow = row + 1;
          stream.write(`${output}\n`);
        },
        async finish(): Promise<void> {
          readline.moveCursor(stream, 0, rows - cursorRow + 1);
          if (config.hideCursor) {
            TerminalUtil.enableCursor(stream);
          }
        }
      };
    } else {
      return {
        init,
        async update(row, output): Promise<void> {
          responses[row] = output;
        },
        async finish(): Promise<void> {
          for (const response of responses) {
            stream.write(`${response}\n`);
          }
        }
      };
    }
  }
}