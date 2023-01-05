import tty from 'tty';

import { ColorDefineUtil, RGBInput } from './color-define';
import { ANSICodes } from './codes';

type Style =
  { text?: RGBInput, background?: RGBInput, italic?: boolean, underline?: boolean, inverse?: boolean, blink?: boolean };

export type StyleInput = Style | RGBInput;
type Prim = string | number | boolean | Date | RegExp;
type ColorPaletteInput = Record<string, StyleInput>;
type ColorFn = (text: Prim) => string;
type ColorPalette<T> = Record<keyof T, ColorFn>;

const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;
type ColorBits = keyof (typeof COLOR_LEVEL_MAP);
export type ColorLevel = (typeof COLOR_LEVEL_MAP)[ColorBits];

/**
 * Utils for colorizing output
 */
export class ColorOutputUtil {

  static #level: ColorLevel | undefined;

  static set colorLevel(level: ColorLevel | undefined) {
    this.#level = level;
  }

  static get colorLevel(): ColorLevel {
    return this.#level ??= this.detectColorLevel(process.stdout);
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
      levelPairs[level] = [
        ANSICodes.STYLE(prefix),
        ANSICodes.STYLE(suffix.reverse())
      ];
    }
    return levelPairs;
  }


  /**
   * Detect color level from tty information
   */
  static detectColorLevel(stream: tty.WriteStream): ColorLevel {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return stream.isTTY ? COLOR_LEVEL_MAP[stream.getColorDepth() as ColorBits] : 0;
  }

  /**
   * Make a simple primitive colorer
   */
  static colorer(col: StyleInput): ColorFn {
    const levelPairs = this.getStyledLevels(col);
    return (v: Prim): string => {
      const [prefix, suffix] = levelPairs[this.colorLevel];
      return (v === undefined || v === null) ? '' : `${prefix}${v}${suffix}`;
    };
  }

  /**
   * Creates a color palette based on input styles
   */
  static palette<P extends ColorPaletteInput>(input: P): ColorPalette<P> {
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
  static templateFunction<P extends ColorPaletteInput>(input: P): (key: keyof P, val: Prim) => string {
    const pal = this.palette(input);
    return (key: keyof P, val: Prim) => pal[key](val);
  }
}