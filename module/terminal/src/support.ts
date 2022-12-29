import tty from 'tty';

import { TypedObject, TemplateType, TemplatePrim, Util } from '@travetto/base';

import { TerminalUtil, ColorLevel, Style, TerminalTable } from './util';
import { RGBInput } from './color-define';

type ColorPaletteInput = Record<string, Style | RGBInput>;
type ColorFn = (text: TemplatePrim) => string;
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
  colorer(col: Style | RGBInput): (prim: TemplatePrim) => string {
    const levelPairs = TerminalUtil.getStyledLevels(col);
    return (v: TemplatePrim): string => {
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
    for (const [k, col] of TypedObject.entries(input)) {
      out[k] = this.colorer(col);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return out as ColorPalette<P>;
  }

  /**
   * Convenience method to creates a color template function based on input styles
   */
  template<P extends ColorPaletteInput>(input: P): TemplateType<P> {
    const pal = this.palette(input);
    return Util.makeTemplate<P>((k, val) => pal[k](val));
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
}

/**
 * Centralized color state that, by default, all console output is tied to
 */
export const GlobalTerminal = new TerminalSupport();