import tty from 'node:tty';

import { ColorDefineUtil } from './color-define';
import { ANSICodes } from './codes';
import {
  RGBInput, TermColorFn, TermColorLevel, TermColorPalette,
  TermColorPaletteInput, TermColorScheme, TermStyle, TermStyleInput
} from './color-types';


const COLOR_LEVEL_MAP = { 1: 0, 4: 1, 8: 2, 24: 3 } as const;
type ColorBits = keyof (typeof COLOR_LEVEL_MAP);
type Prim = Parameters<TermColorFn>[0];

/**
 * Utils for colorizing output
 */
export class ColorOutputUtil {

  /**
   * Detect color level from tty information
   */
  static readTermColorLevel(stream: tty.WriteStream = process.stdout): TermColorLevel {
    const force = process.env.FORCE_COLOR;
    const disable = process.env.NO_COLOR ?? process.env.NODE_DISABLE_COLORS;
    if (force !== undefined) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return Math.max(Math.min(/^\d+$/.test(force) ? parseInt(force, 10) : 1, 3), 0) as TermColorLevel;
    } else if (disable !== undefined && /^(1|true|yes|on)$/i.test(disable)) {
      return 0;
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return stream.isTTY ? COLOR_LEVEL_MAP[stream.getColorDepth() as ColorBits] : 0;
  }

  /**
   * Read foreground/background color if env var is set
   */
  static readBackgroundScheme(env: string | undefined = process.env.COLORFGBG): TermColorScheme | undefined {
    let color = undefined;
    if (env) {
      const [, bg] = env.split(';');
      color = ColorDefineUtil.rgbFromAnsi256(+bg);
    }
    if (color) {
      const hex = `#${color.map(x => x.toString(16).padStart(2, '0')).join('')}` as const;
      return ColorDefineUtil.defineColor(hex).scheme;
    }
  }

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
  static colorer(style: TermStyleInput | [dark: TermStyleInput, light: TermStyleInput], term?: tty.WriteStream): TermColorFn {
    const schemes = {
      light: this.getStyledLevels(Array.isArray(style) ? style[1] ?? style[0] : style),
      dark: this.getStyledLevels(Array.isArray(style) ? style[0] : style),
    };
    const scheme = this.readBackgroundScheme() ?? 'dark';
    const level = this.readTermColorLevel(term);
    return (v: Prim): string => {
      const [prefix, suffix] = schemes[scheme][level];
      return (v === undefined || v === null) ? '' : `${prefix}${v}${suffix}`;
    };
  }

  /**
   * Creates a color palette based on input styles
   */
  static palette<P extends TermColorPaletteInput>(input: P, term?: tty.WriteStream): TermColorPalette<P> {
    // Common color support
    const out: Partial<TermColorPalette<P>> = {};
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    for (const [k, col] of Object.entries(input) as [keyof P, TermStyleInput][]) {
      out[k] = this.colorer(col, term);
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return out as TermColorPalette<P>;
  }

  /**
   * Convenience method to creates a color template function based on input styles
   */
  static templateFunction<P extends TermColorPaletteInput>(input: P, term?: tty.WriteStream): (key: keyof P, val: Prim) => string {
    const pal = this.palette(input, term);
    return (key: keyof P, val: Prim) => pal[key](val);
  }
}