import { TypedObject } from '@travetto/base';

import { TerminalColorUtil, ColorLevel, Style, TemplateType, Prim, ColorPaletteInput } from './util';
import { RGBInput } from './define';

type ColorFn = (text: Prim) => string;
type ColorPalette<T> = Record<keyof T, ColorFn>;

/**
 * Color support with ability to create templates/palettes with named colors
 */
export class TerminalColorSupport {

  #level: ColorLevel = TerminalColorUtil.detectColorLevel();

  /**
   * Set level
   */
  setLevel(level: ColorLevel | 'auto'): this {
    this.#level = level === 'auto' ? TerminalColorUtil.detectColorLevel() : level;
    return this;
  }

  /**
   * Make a simple primitive colorer
   */
  colorer(col: Style | RGBInput): (prim: Prim) => string {
    const levelPairs = TerminalColorUtil.getStyledLevels(col);
    return (v: Prim): string => {
      const [prefix, suffix] = levelPairs[this.#level];
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
    return TerminalColorUtil.makeTemplate<P>((k, val) => pal[k](val));
  }
}

/**
 * Centralized color state that, by default, all console output is tied to
 */
export const ColorSupport = new TerminalColorSupport();