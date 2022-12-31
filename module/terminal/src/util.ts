import tty from 'tty';
import timers from 'timers/promises';
import readline from 'readline';

import { ColorDefineUtil, RGBInput } from './color-define';

export type ColorLevel = 0 | 1 | 2 | 3;

export type Style =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

export type TerminalTable = {
  init(...header: string[]): Promise<void>;
  update(row: number, output: string): Promise<void>;
  finish(): Promise<void>;
};

export type TerminalProgressConfig = { message?: string, showBar?: boolean };
export type TerminalProgressEvent = { i: number, total?: number, status?: string };
export type TerminalProgressInput = AsyncIterator<TerminalProgressEvent> | AsyncIterable<TerminalProgressEvent>;

export type StyleInput = Style | RGBInput;

const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;

type TerminalOpConfig = {
  hideCursor?: boolean;
};

const STD_WAIT_STATES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'.split('');

/**
 * Terminal utilities
 */
export class TerminalUtil {

  static get lineWidth(): number {
    return (process.env.TRV_CONSOLE_WIDTH ? +process.env.TRV_CONSOLE_WIDTH : undefined) ?? process.stdout.columns ?? 120;
  }

  static isInteractiveTTY(stream: tty.WriteStream): boolean {
    return stream.isTTY && !/^(true|yes|on|1)$/.test(process.env.TRV_QUIET ?? '');
  }


  static disableCursor(stream: tty.WriteStream): void {
    if (this.isInteractiveTTY(stream)) {
      stream.write('\x1B[?25l');
    }
  }

  static enableCursor(stream: tty.WriteStream): void {
    if (this.isInteractiveTTY(stream)) {
      stream.write('\x1B[?25h');
    }
  }

  static removeAnsiSequences(output: string): string {
    // eslint-disable-next-line no-control-regex
    return output.replace(/(\x1b|\x1B)\[[?]?[0-9;]+[A-Za-z]/g, '');
  }

  static getStreamColorLevel(stream: tty.WriteStream): ColorLevel {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.isInteractiveTTY(stream) ? COLOR_LEVEL_MAP[stream.getColorDepth() as 1 | 4 | 8 | 24] : 0;
  }

  /**
   * Get styled levels, 0-3
   */
  static getStyledLevels(inp: StyleInput): [string, string][] {
    const cfg = (typeof inp !== 'object') ? { text: inp } : inp;
    const levelPairs: [string, string][] = [['', '']];
    const text = cfg.text ? ColorDefineUtil.getColorCodes(cfg.text, false) : undefined;
    const bg = cfg.background ? ColorDefineUtil.getColorCodes(cfg.background, true) : undefined;

    for (const level of [1, 2, 3]) {
      const prefix: number[] = [];
      const suffix: number[] = [];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      for (const key of Object.keys(cfg) as (keyof typeof cfg)[]) {
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
   * Move cursor
   */
  static async moveCursor(stream: tty.WriteStream, dx: number, dy: number): Promise<void> {
    if (!this.isInteractiveTTY(stream)) {
      return;
    }
    await new Promise<void>(r => readline.moveCursor(stream, dx, dy, r));
  }

  /**
   * Rewrite a single line in the stream
   * @param stream The stream to write
   * @param text Text, if desired
   * @param clear Should the entire line be cleared?
   */
  static async rewriteLine(stream: tty.WriteStream, text?: string, clear = false): Promise<void> {
    if (!this.isInteractiveTTY(stream)) {
      return;
    }
    await new Promise<void>(r => readline.cursorTo(stream, 0, undefined, r));
    if (clear) {
      await new Promise<void>(r => readline.clearLine(stream, 1, r));
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
    if (this.isInteractiveTTY(stream)) {
      return;
    }
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

    if (work && typeof work === 'function') {
      work = work();
    }

    let done = false;
    let value: T | undefined;
    let capturedError: Error | undefined;
    const final = work
      .then(res => value = res)
      .catch(err => capturedError = err)
      .finally(() => done = true);

    let i = -1;

    if (config.hideCursor) {
      this.disableCursor(stream);
    }

    if (delay) {
      await Promise.race([timers.setTimeout(delay), final]);
    }

    if (this.isInteractiveTTY(stream)) {
      stream.write(`X ${message}`);
    }

    const states = config.waitingStates ?? STD_WAIT_STATES;

    while (!done) {
      await this.rewriteChar(stream, 0, states[i % states.length]);
      await timers.setTimeout(50);
      i += 1;
    }

    if (i >= 0) {
      await this.rewriteLine(stream, completion ? `${message} ${completion}\n` : '', true);
    }

    if (config.hideCursor) {
      this.enableCursor(stream);
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
    const counts = new Array(rows).fill(0);
    const interactive = this.isInteractiveTTY(stream);

    return {
      async init(...header: string[]): Promise<void> {
        if (config.hideCursor) {
          TerminalUtil.disableCursor(stream);
        }
        for (const line of header) {
          stream.write(`${line}\n`);
        }
        if (interactive) {
          stream.write(`${'\n'.repeat(rows)}\n`);
        }
        cursorRow = rows + 1;
      },
      async update(row, output): Promise<void> {
        if (counts[row] > 0) {
          await timers.setTimeout(500);
        }
        counts[row] += 1;
        await TerminalUtil.moveCursor(stream, 0, row - cursorRow);
        await TerminalUtil.rewriteLine(stream, output, true);
        cursorRow = row;
        responses[row] = output;
      },
      async finish(): Promise<void> {
        await TerminalUtil.moveCursor(stream, 0, rows - cursorRow + 1);
        await TerminalUtil.rewriteLine(stream, '', true);
        if (config.hideCursor) {
          TerminalUtil.enableCursor(stream);
        }
        if (!interactive) {
          for (const response of responses) {
            stream.write(`${response}\n`);
          }
          stream.write('\n');
        }
      }
    };
  }

  static async trackProgress(stream: tty.WriteStream, source: TerminalProgressInput, cfg: TerminalProgressConfig = {}): Promise<void> {
    if (Symbol.asyncIterator in source) {
      source = source[Symbol.asyncIterator]();
    }
    const invert = this.getStyledLevels({ background: 'white', text: 'dodgerBlue' });
    const interactive = this.isInteractiveTTY(stream);
    let last: number = -1;
    try {
      this.disableCursor(stream);
      for (; ;) {
        const res = await source.next();
        if (interactive && res.value) {
          const { i, total, status } = res.value;
          if (i > last) {
            last = i;
            if (total) {
              const line = [cfg.message, `${i}/${total}`, status].filter(x => !!x).join(' ');
              if (cfg.showBar) {
                const full = line.padEnd(this.lineWidth, ' ');
                const pct = Math.trunc(full.length * (i / total));
                await this.rewriteLine(stream, `${invert[1][0]}${full.substring(0, pct)}${invert[1][1]}${full.substring(pct)}`, true);
              } else {
                await this.rewriteLine(stream, line, true);
              }
            } else {
              await this.rewriteLine(stream, [cfg.message, i, status].filter(x => !!x).join(' '), true);
            }
          }
        }
        if (res.done) {
          break;
        }
      }
    } finally {
      await this.rewriteLine(stream, '', true);
      this.enableCursor(stream);
    }
  }
}