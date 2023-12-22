import { ANSICodes } from './codes';
import { TermState } from './types';

type TermCoord = { x: number, y: number };

const boundIndex = (v: number, size: number): number => {
  if (v < 0) {
    v = size + v;
  }
  return Math.max(Math.min(v, size - 1), 0);
};

/**
 * Buffered/batched writer.  Meant to be similar to readline.Readline, but with more general writing support and extensibility
 */
export class TerminalWriter {

  static for(term: TermState): TerminalWriter {
    return new TerminalWriter(term);
  }

  #queue: (string | number)[] = [];
  #term: TermState;
  #restoreOnCommit = false;

  constructor(term: TermState) {
    this.#term = term;
  }

  /** Restore on commit */
  restoreOnCommit(): this {
    this.#restoreOnCommit = true;
    return this;
  }

  commit(restorePosition: boolean = this.#restoreOnCommit): Promise<void> {
    const q = this.#queue.filter(x => x !== undefined);
    this.#queue = [];
    if (q.length && restorePosition) {
      q.unshift(ANSICodes.POSITION_SAVE());
      q.push(ANSICodes.POSITION_RESTORE());
    }
    if (q.length) {
      const done = this.#term.output.write(q.join(''));
      if (!done) {
        return new Promise(r => this.#term.output.once('drain', () => r()));
      }
    }
    return Promise.resolve();
  }

  write(...text: (string | number)[]): this {
    this.#queue.push(...text);
    return this;
  }

  /** Stores current cursor position, if called multiple times before restore, last one ones */
  storePosition(): this {
    return this.write(ANSICodes.POSITION_SAVE());
  }

  /** Restores cursor position, will not behave correctly if nested  */
  restorePosition(): this {
    return this.write(ANSICodes.POSITION_RESTORE());
  }

  /** Rewrite a single line in the stream  */
  rewriteLine(text: string): this {
    return this.setPosition({ x: 0 }).write(text);
  }

  /** Clear line, -1 (left), 0 (both), 1 (right), from current cursor */
  clearLine(dir: -1 | 0 | 1 = 0): this {
    return this.write(ANSICodes.ERASE_LINE(dir === 0 ? 2 : (dir === 1 ? 0 : 1)));
  }

  /** Set position */
  setPosition({ x = 0, y }: Partial<TermCoord>): this {
    if (y !== undefined) {
      y = boundIndex(y, this.#term.output.rows);
    }
    x = boundIndex(x, this.#term.output.columns);
    if (y !== undefined) {
      return this.write(ANSICodes.POSITION_SET(y + 1, x + 1));
    } else {
      return this.write(ANSICodes.COLUMN_SET(x + 1));
    }
  }

  /** Relative movement */
  changePosition({ x, y }: Partial<TermCoord>): this {
    if (x) {
      this.write(ANSICodes.CURSOR_DX(x));
    }
    if (y) {
      this.write(ANSICodes.CURSOR_DY(y));
    }
    return this;
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
        text = text.replaceAll('\n', `${ANSICodes.ERASE_LINE(0)}\n`);
      }
      text = `${text}\n`;
    }
    return this.write(text);
  }

  /** Show cursor */
  showCursor(): this {
    return this.write(ANSICodes.SHOW_CURSOR());
  }

  /** Hide cursor */
  hideCursor(): this {
    return this.write(ANSICodes.HIDE_CURSOR());
  }

  /** Set scrolling range */
  scrollRange({ start, end }: { start?: number, end?: number }): this {
    start = boundIndex(start ?? 0, this.#term.output.rows);
    end = boundIndex(end ?? -1, this.#term.output.rows);
    return this.write(ANSICodes.SCROLL_RANGE_SET(start + 1, end + 1));
  }

  /** Clear scrolling range */
  scrollRangeClear(): this {
    return this.write(ANSICodes.SCROLL_RANGE_CLEAR());
  }

  /** Scrolling window y <=0 - up,  else down */
  scrollY(y: number): this {
    return this.write(ANSICodes.SCROLL_WINDOW(y));
  }

  /** Reset */
  softReset(): this {
    return this.write(ANSICodes.SOFT_RESET_CODES());
  }
}