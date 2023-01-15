import { ColorDefineUtil, RGBInput } from './color-define';
import { ANSICodes } from './codes';
import { TermState } from './types';

export type TermStyle =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

export type TermStyleInput = TermStyle | RGBInput;
export type Prim = string | number | boolean | Date | RegExp;
export type TermColorPaletteInput = Record<string, TermStyleInput | [TermStyleInput, TermStyleInput]>;
export type TermColorFn = (text: Prim) => string;
export type TermColorPalette<T> = Record<keyof T, TermColorFn>;

/**
 * Utils for colorizing output
 */
export class ColorOutputUtil {

  /**
   * Get styled levels, 0-3
   */
  static getStyledLevels(inp: TermStyle | RGBInput): [string, string][] {
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
      levelPairs[level] = [
        ANSICodes.STYLE(prefix),
        ANSICodes.STYLE(suffix.reverse())
      ];
    }
    return levelPairs;
  }

  /**
   * Make a simple primitive colorer
   */
  static colorer(term: TermState, style: TermStyleInput | [light: TermStyleInput, dark: TermStyleInput]): TermColorFn {
    const schemes = {
      light: this.getStyledLevels(Array.isArray(style) ? style[1] ?? style[0] : style),
      dark: this.getStyledLevels(Array.isArray(style) ? style[0] : style),
    };
    return (v: Prim): string => {
      const [prefix, suffix] = schemes[term.backgroundScheme][term.colorLevel];
      return (v === undefined || v === null) ? '' : `${prefix}${v}${suffix}`;
    };
  }

  /**
   * Creates a color palette based on input styles
   */
  static palette<P extends TermColorPaletteInput>(term: TermState, input: P): TermColorPalette<P> {
    // Common color support
    const out: Partial<TermColorPalette<P>> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const [k, col] of Object.entries(input) as [keyof P, TermStyleInput][]) {
      out[k] = this.colorer(term, col);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return out as TermColorPalette<P>;
  }

  /**
   * Convenience method to creates a color template function based on input styles
   */
  static templateFunction<P extends TermColorPaletteInput>(term: TermState, input: P): (key: keyof P, val: Prim) => string {
    const pal = this.palette(term, input);
    return (key: keyof P, val: Prim) => pal[key](val);
  }
}