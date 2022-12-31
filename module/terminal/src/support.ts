import tty from 'tty';

import { TerminalUtil, ColorLevel, StyleInput, TerminalTable, TerminalProgressInput, TerminalProgressConfig } from './util';

type Prim = string | number | boolean | Date | RegExp;
type ColorPaletteInput = Record<string, StyleInput>;
type ColorFn = (text: Prim) => string;
type ColorPalette<T> = Record<keyof T, ColorFn>;

/**
 * Terminal support
 */
export class TerminalSupport {

  #stream: tty.WriteStream;
  #colorLevel: ColorLevel;

  constructor(stream: tty.WriteStream = process.stdout) {
    this.#stream = stream;
    this.#colorLevel = TerminalUtil.getStreamColorLevel(stream);
  }

  /**
   * Set level
   */
  setColorLevel(level: ColorLevel | 'auto'): this {
    this.#colorLevel = level === 'auto' ? TerminalUtil.getStreamColorLevel(this.#stream) : level;
    return this;
  }

  /**
   * Make a simple primitive colorer
   */
  colorer(col: StyleInput): (prim: Prim) => string {
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
   * Disable cursor for wrapped stream
   */
  disableCursor(): void {
    TerminalUtil.disableCursor(this.#stream);
  }

  /**
   * Enable cursor for wrapped stream
   */
  enableCursor(): void {
    TerminalUtil.enableCursor(this.#stream);
  }

  /**
   * Show waiting indicator while work is being completed
   */
  async waiting<T>(message: string, work: Promise<T> | (() => Promise<T>),
    config: { completion?: string, delay?: number } = {}
  ): Promise<T> {
    return TerminalUtil.waiting<T>(this.#stream, message, work, { ...config, hideCursor: true });
  }

  /**
   * Provide a table interface for streaming results into
   */
  table(rows: number): TerminalTable {
    return TerminalUtil.makeTable(this.#stream, rows, { hideCursor: true });
  }

  /**
   * Track progress on an async operation
   */
  async trackProgress(source: TerminalProgressInput, cfg: TerminalProgressConfig = {}): Promise<void> {
    return TerminalUtil.trackProgress(this.#stream, source, cfg);
  }
}

/**
 * Centralized color state that, by default, all console output is tied to
 */
export const GlobalTerminal = new TerminalSupport();