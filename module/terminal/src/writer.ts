import tty from 'node:tty';

type State = { output: tty.WriteStream, height: number, width: number };
type TermCoord = { x: number, y: number };

const ESC = '\x1b[';
const clamp = (v: number, size: number): number => Math.max(Math.min(v + (v < 0 ? size : 0), size - 1), 0);
const delta = (v: number | undefined, pos: string, neg: string): string =>
  !v ? '' : `${ESC}${Math.abs(v)}${v < 0 ? neg : pos}`;

const Codes = {
  SHOW_CURSOR: `${ESC}?25h`,
  HIDE_CURSOR: `${ESC}?25l`,
  SCROLL_RANGE_CLEAR: `${ESC}r`,
  POSITION_RESTORE: `${ESC}u`,
  POSITION_SAVE: `${ESC}s`,
  SOFT_RESET: `${ESC}!p`,
  ERASE_LINE_RIGHT: `${ESC}0K`,
  ERASE_LINE_LEFT: `${ESC}1K`,
  ERASE_LINE_ALL: `${ESC}2K`,

  DEBUG: (text: string): string => text.replaceAll(ESC, '<ESC>').replaceAll('\n', '<NL>'),
  CURSOR_MOVE: (x?: number, y?: number): string => `${delta(x, 'C', 'D')}${delta(y, 'B', 'A')}`,
  POSITION_SET: (x: number, y: number | undefined, maxX: number, maxY: number): string => y !== undefined ?
    `${ESC}${clamp(y, maxY) + 1};${clamp(x, maxX) + 1}H` : `${ESC}${clamp(x, maxX) + 1}G`,
  SCROLL_RANGE_SET: (start: number, end: number, max: number): string =>
    `${ESC}${clamp(start, max) + 1};${clamp(end, max) + 1}r`
};

/**
 * Buffered/batched writer.  Meant to be similar to readline.Readline, but with more general writing support and extensibility
 */
export class TerminalWriter {

  static reset(): void {
    process.stdout.isTTY && process.stdout.write(Codes.SOFT_RESET);
    process.stderr.isTTY && process.stderr.write(Codes.SOFT_RESET);
  }

  #buffer: (string | number)[] = [];
  #restoreOnCommit = false;
  #term: State;

  constructor(state: State) {
    this.#term = state;
  }

  /** Pad to width of terminal */
  padToWidth(text: string, offset = 0, ellipsis = '...'): string {
    if (text.length > (this.#term.width - offset)) {
      return `${text.substring(0, this.#term.width - (offset + ellipsis.length))}${ellipsis}`;
    }
    return text.padEnd(this.#term.width - offset, ' ');
  }

  /** Restore on commit */
  restoreOnCommit(): this {
    this.#restoreOnCommit = true;
    return this;
  }

  commit(restorePosition: boolean = this.#restoreOnCommit): Promise<void> {
    const q = this.#buffer.filter(x => x !== undefined);
    this.#buffer = [];
    if (q.length && restorePosition) {
      q.unshift(Codes.POSITION_SAVE);
      q.push(Codes.POSITION_RESTORE);
    }
    if (q.length && !this.#term.output.write(q.join(''))) {
      return new Promise<void>(r => this.#term.output.once('drain', r));
    } else {
      return Promise.resolve();
    }
  }

  write(...text: (string | number)[]): this {
    this.#buffer.push(...text);
    return this;
  }

  /** Stores current cursor position, if called multiple times before restore, last one ones */
  storePosition(): this {
    return this.write(Codes.POSITION_SAVE);
  }

  /** Restores cursor position, will not behave correctly if nested  */
  restorePosition(): this {
    return this.write(Codes.POSITION_RESTORE);
  }

  /** Clear line, -1 (left), 0 (both), 1 (right), from current cursor */
  clearLine(dir: -1 | 0 | 1 = 0): this {
    switch (dir) {
      case 0: return this.write(Codes.ERASE_LINE_ALL);
      case 1: return this.write(Codes.ERASE_LINE_RIGHT);
      case -1: return this.write(Codes.ERASE_LINE_LEFT);
    }
  }

  /** Set position */
  setPosition({ x = 0, y }: Partial<TermCoord>): this {
    return this.write(Codes.POSITION_SET(x, y, this.#term.width, this.#term.height));
  }

  /** Relative movement */
  changePosition({ x, y }: Partial<TermCoord>): this {
    return this.write(Codes.CURSOR_MOVE(x, y));
  }

  /** Write single line */
  writeLine(line: string = ''): this {
    return this.write(`${line}\n`);
  }

  /** Write multiple lines */
  writeLines(lines: (string | undefined)[], clear = false): this {
    lines = lines.filter(x => x !== undefined);
    let text = lines.join('\n');
    if (text.length > 0) {
      if (clear) {
        text = text.replaceAll('\n', `${Codes.ERASE_LINE_RIGHT}\n`);
      }
      text = `${text}\n`;
    }
    return this.write(text);
  }

  /** Show cursor */
  showCursor(): this {
    return this.write(Codes.SHOW_CURSOR);
  }

  /** Hide cursor */
  hideCursor(): this {
    return this.write(Codes.HIDE_CURSOR);
  }

  /** Set scrolling range */
  scrollRange({ start = 0, end = -1 }: { start?: number, end?: number }): this {
    return this.write(Codes.SCROLL_RANGE_SET(start, end, this.#term.height));
  }

  /** Clear scrolling range */
  scrollRangeClear(): this {
    return this.write(Codes.SCROLL_RANGE_CLEAR);
  }

  /** Reset */
  softReset(): this {
    return this.write(Codes.SOFT_RESET);
  }
}