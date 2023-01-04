import readline from 'readline/promises';
import tty from 'tty';

import { TerminalUtil, StyleInput, TerminalTableEvent, TerminalProgressEvent, TerminalOpConfig, TerminalWaitingConfig, ColorLevel } from './util';

type Prim = string | number | boolean | Date | RegExp;
type ColorPaletteInput = Record<string, StyleInput>;
type ColorFn = (text: Prim) => string;
type ColorPalette<T> = Record<keyof T, ColorFn>;

type TerminalProgressConfig = TerminalOpConfig & { message?: string, showBar?: 'bottom' | 'top' | 'inline' };
type TerminalTableConfig = TerminalOpConfig & { header?: string[], forceNonInteractiveOrder?: boolean };

/**
 * An enhanced tty write stream
 */
export class TerminalOutput {

  #stream: tty.WriteStream;
  #interactive: boolean;
  #width: number;
  #colorLevel: ColorLevel;
  #readline: readline.Readline;

  constructor(stream: tty.WriteStream, interactive?: boolean, width?: number, colorLevel?: ColorLevel) {
    this.#stream = stream;
    this.#interactive = interactive ?? TerminalUtil.detectInteractive(stream);
    this.#width = width ?? stream.columns ?? 120;
    this.#readline = new readline.Readline(this.#stream);
    this.setColorLevel(colorLevel ?? 'auto');
    if (this.#interactive && width === undefined) {
      this.#stream.on('resize', () => this.#width = this.#stream.columns ?? 120);
    }
  }

  get width(): number {
    return this.#width;
  }

  async #write(text: string): Promise<void> {
    if (text) {
      await new Promise(r => this.#stream.write(text, r));
    }
  }

  /**
  * Rewrite a single line in the stream
  * @param text Text, if desired
  * @param clear Should the entire line be cleared?
  */
  async #rewriteLine(text: string, clear?: boolean): Promise<void> {
    this.#readline.cursorTo(0);

    if (clear) {
      this.#readline.clearLine(1);
    }

    await this.#readline.commit();

    if (text) {
      await this.#write(text);
    }

    await this.#readline.cursorTo(0).commit();
  }

  async #writeLines(lines: string[]): Promise<void> {
    for (const line of lines) {
      await this.#writeLine(line);
    }
  }

  async #writeLine(line: string = ''): Promise<void> {
    await this.#readline.cursorTo(0).clearLine(1).commit();
    await this.#write(`${line}\n`);
  }

  /**
   * Show/hide the cursor
   */
  async showCursor(active: boolean): Promise<void> {
    await this.#write(`\x1B[?25${active ? 'h' : 'l'}`);
  }

  /**
   * Disable the cursor
   */
  async #restoreWhenDone(work: () => Promise<void>): Promise<void> {
    try {
      await this.#write('\x1b7');
      await work();
    } finally {
      await this.#write('\x1b8');
    }
  }

  /**
   * Set level
   */
  setColorLevel(level: ColorLevel | 'auto'): this {
    this.#colorLevel = level === 'auto' ? TerminalUtil.detectColorLevel(this.#stream) : level;
    return this;
  }

  /**
   * Make a simple primitive colorer
   */
  colorer(col: StyleInput): ColorFn {
    const levelPairs = TerminalUtil.getStyledLevels(col);
    return (v: Prim): string => {
      const [prefix, suffix] = levelPairs[this.#colorLevel];
      return (v === undefined || v === null) ? '' : `${prefix}${v}${suffix}`;
    };
  }

  /**
   * Creates a color palette based on input styles
   */
  palette<P extends ColorPaletteInput>(input: P): ColorPalette<P> {
    // Common color support
    const out: Partial<ColorPalette<P>> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const [k, col] of Object.entries(input) as [keyof P, StyleInput][]) {
      out[k] = this.colorer(col);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return out as ColorPalette<P>;
  }

  /**
   * Convenience method to creates a color template function based on input styles
   */
  templateFunction<P extends ColorPaletteInput>(input: P): (key: keyof P, val: Prim) => string {
    const pal = this.palette(input);
    return (key: keyof P, val: Prim) => pal[key](val);
  }

  /**
   * Waiting message with a callback to end
   *
   * @param message Message to share
   * @param delay Delay duration
   */
  async withWaiting<T>(message: string, work: Promise<T> | (() => Promise<T>), config: TerminalWaitingConfig = {}): Promise<T> {
    const { completion, interactive = this.#interactive } = config;

    let done = false;

    if (interactive && !config.showCursor) {
      await this.showCursor(false);
    }

    // Do not wait, will run in background until done
    TerminalUtil.waitingIndicator(message, () => done,
      (text, idx) => idx === 0 ? this.#writeLine(text) : this.#rewriteLine(text),
      { ...config, interactive }
    );

    try {
      const out = await (typeof work === 'function' ? work() : work);
      if (interactive) {
        await this.#rewriteLine(completion ? `${message} ${completion}\n` : '', true);
      }
      return out;
    } finally {
      done = true;
      if (interactive && !config.showCursor) {
        await this.showCursor(true);
      }
    }
  }

  /**
   * Consumes a stream, of events, tied to specific list indices, and updates in place
   */
  async makeList<T>(source: AsyncIterable<T>, resolve: (val: T) => TerminalTableEvent, config: TerminalTableConfig = {}): Promise<void> {
    const { interactive = this.#interactive, forceNonInteractiveOrder: forceOrder } = config;

    await this.#writeLines(config.header ?? []);

    if (interactive) {
      if (!config.showCursor) {
        await this.showCursor(false);
      }
    }

    const statuses: string[] = [];

    const size = await TerminalUtil.trackLinesWithGrowth(
      source,
      resolve,
      async ({ idx, text, done }) => {
        if (interactive) {
          this.#readline.moveCursor(0, idx);
          await this.#rewriteLine(text, true);
          await this.#readline.moveCursor(0, -idx).commit();
        } else if (done) {
          if (!forceOrder) {
            await this.#writeLine(text);
          } else {
            statuses[idx] = text;
          }
        }
      },
      async (dr: number, total: number) => {
        if (interactive) {
          await this.#restoreWhenDone(() => this.#write('\n'.repeat(total - 1))); // Fill out table
        }
      }
    );

    if (interactive) {
      if (!config.showCursor) {
        await this.showCursor(true);
      }
      await this.#readline.moveCursor(0, size).commit();
      await this.#write('\n');
    } else if (forceOrder) {
      await this.#writeLines(statuses);
    }

    await this.#writeLine();
  }

  /**
   * Track progress of an asynchronous iterator, allowing the showing of a progress bar if the stream produces idx and total
   */
  async trackProgress<T>(source: AsyncIterable<T>, resolve: (val: T) => TerminalProgressEvent, config: TerminalProgressConfig = {}): Promise<void> {
    const { interactive = this.#interactive, showCursor, message, showBar } = config;

    if (interactive) {
      let og = { y: 0 };
      if (showBar === 'bottom') {
        await this.#write(`\x1b[1;${this.#stream.rows - 1}r`);
      } else if (showBar === 'top') {
        await this.#write(`\x1b[2;${this.#stream.rows}r`);
      } else {
        og = await TerminalUtil.queryCursorPosition(process.stdin, this.#stream);
        await this.#writeLine(); // Move past line
      }

      const color = config.showBar ? this.colorer({ background: 'green', text: 'white' }) : (v: string): string => v;

      const drawStatus = (text: string, clear = false): Promise<void> => this.#restoreWhenDone(async () => {
        switch (showBar) {
          case 'bottom': await this.#readline.cursorTo(0, this.#stream.rows - 1).commit(); break;
          case 'top': await this.#readline.cursorTo(0, 0).commit(); break;
          case 'inline': await this.#readline.cursorTo(0, og.y).commit(); break;
        }
        await this.#rewriteLine(text, clear);
      });

      try {
        if (!showCursor) {
          await this.showCursor(false);
        }
        await TerminalUtil.trackProgress(
          source, resolve,
          (idx, total, status) => [message, total ? `${idx}/${total}` : '', status].filter(x => !!x).join(' ').padEnd(this.width),
          (left, right) => drawStatus(`${color(left)}${right}`)
        );
      } finally {
        await drawStatus('', true);
        if (!showCursor) {
          await this.showCursor(true);
        }
        switch (showBar) {
          case 'top': await this.#write('\x1b[r'); break;
          case 'bottom': {
            await this.#write('\x1b[r');
            await this.#readline.cursorTo(0, this.#stream.rows - 1).commit();
            break;
          }
        }
      }
    } else {
      if (message) {
        await this.#writeLine(`${message}...`);
      }
      // Drain events
      for await (const _ of source) { }
    }
  }
}

export const GlobalOutput = new TerminalOutput(process.stdout);